var rlp = require('rlp'),
    assert = require('assert'),
    Trie = require('merkle-patricia-tree'),
    async = require('async'),
    bignum = require('bignum'),
    Account = require('./account.js'),
    VM = require('./vm');

var internals = {};

module.exports = internals.State = function (stateDB) {
    if (stateDB.constructor !== Trie) {
        this.trie = new Trie(stateDB);
    } else {
        this.trie = stateDB;
    }
};

internals.State.prototype.generateGenesis = function (cb) {
    var self = this,
        addresses = [
            '1a26338f0d905e295fccb71fa9ea849ffa12aaf4',
            'b9c015918bdaba24b4ff057a92a3873d6eb201be',
            '2ef47100e0787b915105fd5e3f4ff6752079d5cb',
            '51ba59315b3a95761d0863b05ccc7a7f54703d99',
            '6c386a4b26f73c802f34673f7248bb118f97424a',
            'cd2a3d9f938e13cd947ec05abc7fe734df8dd826',
            'e4157b34ea9615cfbde6b4fda419828124b70c78',
            'e6716f9544a56c530d868e4bfbacb172315bdead'
        ];

    this.trie.checkpoint();

    async.each(addresses, function (address, done) {
        var account = new Account(),
            startAmount = new Buffer(26);

        startAmount.fill(0);
        startAmount[0] = 1;
        account.balance = startAmount;

        self.trie.put(new Buffer(address, 'hex'), account.serialize(), function () {
            done();
        });

    }, function (err) {
        if (!err) {
            self.trie.commit(cb);
        } else {
            cb(err);
        }
    });
};


/**
 * Process a transaction. Run the vm. Transfers eth. checks balaces
 * @method processTx
 * @param {Transaciton} tx - a transaction
 * @param {Block} block needed to process the transaction
 * @param {Function} cb - the callback
 */
internals.State.prototype.processTx = function (tx, block, cb) {
    var address = new Buffer(tx.getSenderAddress(), 'hex'),
        self = this,
        fromAccount,
        toAccount;

    async.auto({
        getSender: function (cb2) {
            //gets the senders account
            self.trie.get(address, function (err, account) {
                fromAccount = new Account(account);
                cb2(err, fromAccount);
            });
        },
        getReceiver: function (cb2) {
            //get receivers account
            self.trie.get(tx.to, function (err, account) {
                toAccount = new Account(account);
                cb2(err, toAccount);
            });
        },
        processAccounts: ['getSender', 'getReceiver',
            function (cb2) {

                var fromBalance = bignum.fromBuffer(fromAccount.balance),
                    fromNonce = bignum.fromBuffer(fromAccount.nonce);

                //does the sender have enought money and the correct nonce?
                if (fromBalance.ge(bignum(tx.getUpfrontCost())) && fromNonce.qe(bignum.fromBuffer(tx.nonce))) {

                    //add the amount sent to the `to` account
                    toAccount.balance = bignum
                        .fromBuffer(toAccount.balance)
                        .add(bignum.fromBuffer(tx.value))
                        .toBuffer();

                    //incement the senders nonce
                    fromAccount.nonce = bignum.fromBuffer(fromAccount.nonce).add(1).toBuffer();
                    //subcract the the amount sent and the TX fee
                    fromBalance.sub(bignum.fromBuffer(tx.value))
                        .sub(tx.getBaseFee);

                    fromAccount.balance = fromBalance.toBuffer();
                    cb2();

                } else {
                    cb2('sender doesn\' have correct nonce or balance');
                }

            }
        ],
        saveReceiver: ['processAccounts',
            function (cb2) {
                //save accounts
                self.trie.put(tx.to, toAccount.serialize(), cb2);
            }
        ],
        saveSender: ['runVM',
            function (cb2) {
                self.trie.put(address, fromAccount.serialize(), cb2);
            }
        ],
        runVM: ['saveReceiver',
            function (cb2) {
                //run VM
                if (toAccount.isContract() || toAccount.to.toString('hex') === '00') {
                    var vm = new VM({
                        block: block,
                        trie: self.trie
                    });

                    vm.run({
                        tx: tx,
                        to: toAccount
                    }, function (err, results) {
                        fromAccount.balance = bignum.fromBuffer(fromAccount.balance)
                            .sub(results.gasUsed)
                            .toBuffer();
                        cb2(err);
                    });
                } else {
                    cb2();
                }
            }
        ]
    }, cb);
};

//pay the miners
internals.State.prototype.processBlock = function (block, root, cb) {
    //pay the miner
    if (arguments.length === 2) {
        cb = root;
        root = null;
    }

    var trie = this.trie,
        self = this;

    trie.checkpoint();
    if (root) trie.root = root;
    var account;

    async.series([
        //1 validate unciles
        //run transactions
        function (callback) {
            async.eachSeries(block.transactionReceipts, function (tr, cb2) {
                if (tr.transaction.validate()) {
                    // self.processTx(tr.transaction, block, function (err) {
                    //     if (tr.state.toString('hex') !== trie.root.toString('hex')) {
                    //         err = 'state hash doesn\'t match the state hash from the transaction receipt';
                    //     }
                    //     cb2(err);
                    // });
                    var vm = new VM({
                        block: block,
                        trie: self.trie
                    });

                    vm.runTx(tr.transaction, function () {
                        var err = null;
                        if (tr.state.toString('hex') !== trie.root.toString('hex')) {
                            err = 'state hash doesn\'t match the state hash from the transaction receipt';
                        }
                        cb2(err);
                    });
                } else {
                    cb2('invalid transaction');
                }
            }, callback);
        },
        //get the miners account
        function (callback) {
            trie.get(block.header.coinbase, function (err, rawAccount) {
                account = new Account(rawAccount);
                callback();
            });
        },
        function (callback) {
            //1500 finniy to the miner
            account.balance = bignum.fromBuffer(account.balance).add(bignum(1500).mul(bignum(10).pow(15))).toBuffer();
            trie.put(block.header.coinbase, account.serialize(), function () {
                callback();
            });
        },
        //give the uncles thiers payout
        function (callback) {
            //iterate over the uncles
            async.eachSeries(block.uncleHeaders, function (uncle, done) {
                var uncleAccount;
                async.series([
                    //get the miners account
                    function (callback) {
                        trie.get(uncle.coinbase, function (err, rawAccount) {
                            uncleAccount = new Account(rawAccount);
                            callback();
                        });
                    },
                    function (callback) {
                        //1500 * 7/8 finniy to the miner
                        uncleAccount.balance = bignum.fromBuffer(account.balance).add(bignum(1500).mul(bignum(10).pow(15)).mul(7).div(8)).toBuffer();
                        trie.put(uncle.coinbase, uncleAccount.serialize(), function () {
                            callback();
                        });
                    }
                ], done);
            }, callback);
        }
    ], function (err) {
        if (!err) {
            trie.commit(cb);
        } else {
            trie.revert();
            cb(err);
        }
    });
};
