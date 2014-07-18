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

//pay the miners
internals.State.prototype.processBlock = function (block, root, cb) {
    //pay the miner
    if (arguments.length === 2) {
        cb = root;
        root = null;
    }

    var trie = this.trie,
        self = this,
        account,
        spentOnGas = bignum(0),
        vm = new VM({
            block: block,
            trie: self.trie
        });

    trie.checkpoint();
    if (root) trie.root = root;

    async.series([
        //get the miners account
        function (callback) {
            trie.get(block.header.coinbase, function (err, rawAccount) {
                account = new Account(rawAccount);
                callback();
            });
        },
        function (callback) {
            async.eachSeries(block.transactionReceipts, function (tr, cb2) {
                if (tr.transaction.validate()) {

                    vm.runTx(tr.transaction, function (err, results) {
                        if (!err) {
                            spentOnGas = spentOnGas.add(results.amountSpent);

                            account.balance = bignum
                                .fromBuffer(account.balance)
                                .add(spentOnGas);

                            trie.put(block.header.coinbase, account.serialize(), function (err) {
                                if (tr.state.toString('hex') !== trie.root.toString('hex')) {
                                    err = 'state hash doesn\'t match the state hash from the transaction receipt';
                                }
                                cb2(err);
                            });
                        }else{
                            cb2(err);
                        }
                    });
                } else {
                    cb2('invalid transaction');
                }
            }, callback);
        },
        function (callback) {
            //1500 finniy to the miner + amount spent on gas
            account.balance = bignum
                .fromBuffer(account.balance)
                .add(bignum(1500).mul(bignum(10).pow(15)))
                .toBuffer();

            trie.put(block.header.coinbase, account.serialize(), function () {
                callback();
            });
        },
        //give the uncles thiers payout
        function (callback) {
            //iterate over the uncles
            async.each(block.uncleHeaders, function (uncle, done) {
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
                        uncleAccount.balance = bignum.fromBuffer(account.balance)
                            .add(bignum(1500).mul(bignum(10).pow(15)).mul(7).div(8))
                            .toBuffer();

                        trie.put(uncle.coinbase, uncleAccount.serialize(), function () {
                            callback();
                        });
                    }
                ], done);
            }, callback);
        }
    ], function (err) {
        if (trie.root.toString('hex') !== block.header.stateRoot.toString('hex')) {
            trie.revert();
            cb('invalid block stateRoot');
        } else if (!err) {
            trie.commit(cb);
        } else {
            trie.revert();
            cb(err);
        }
    });
};
