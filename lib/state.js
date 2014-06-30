var rlp = require('rlp'),
    Trie = require('merkle-patricia-tree'),
    async = require('async'),
    bignum = require('bignum'),
    Account = require('./account.js');

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
            '1e12515ce3e0f817a4ddef9ca55788a1d66bd2df',
            '2ef47100e0787b915105fd5e3f4ff6752079d5cb',
            '51ba59315b3a95761d0863b05ccc7a7f54703d99',
            '6c386a4b26f73c802f34673f7248bb118f97424a',
            'cd2a3d9f938e13cd947ec05abc7fe734df8dd826',
            'e4157b34ea9615cfbde6b4fda419828124b70c78',
            'e6716f9544a56c530d868e4bfbacb172315bdead'
        ];

    this.trie.checkpoint();

    async.eachSeries(addresses, function (address, done) {
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

internals.State.prototype.validateTx = function () {};

internals.State.prototype.addTx = function () {};

internals.State.prototype.loadAccount = function (account) {
    this.trie.get(account);
    //get memory
    //get code
};

internals.State.prototype.validateBlock = function () {};

internals.State.prototype.processTx = function (tx, cb) {
    var address = new Buffer(tx.getSenderAddress(), 'hex'),
        self = this;

    self.trie.get(address, function (err, account) {
        var fromAccount = new Account(account),
            balance = bignum.fromBuffer(fromAccount.balance);

        if (balance.ge(bignum(tx.getUpfrontCost()))) {
            fromAccount.nonce = bignum.fromBuffer(fromAccount.nonce).add(1).toBuffer();
            self.trie.get(tx.to, function (err, account) {
                var toAccount = new Account(account);

                //add the amount sent to the `to` account
                toAccount.balance = bignum.
                fromBuffer(toAccount.balance).
                add(bignum.fromBuffer(tx.value)).
                toBuffer();

                //subtract the amount sent from the sending account 
                fromAccount.balance = bignum.
                fromBuffer(fromAccount.balance).
                sub(bignum.fromBuffer(tx.value)).
                toBuffer();

                //save accounts
                self.trie.put(tx.to, toAccount.serialize(), function () {
                    self.trie.put(address, fromAccount.serialize(), cb);
                });
            });

        } else {
            cb('not enought gas in sender\'s account');
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
        self = this;

    trie.checkpoint();
    if (root) trie.root = root;
    var account;

    async.series([
        //1 validate unciles
        //run transactions
        function (callback) {
            async.eachSeries(block.transactionReceipts, function (tr, cb2) {
                self.processTx(tr.transaction, function () {
                    cb2();
                });
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
            cb(err);
        }
    });
};
