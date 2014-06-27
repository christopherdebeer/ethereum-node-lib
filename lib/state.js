var rlp = require('rlp'),
    async = require('async'),
    bignum = require('bignum'),
    Account = require('./account.js');

var internals = {};

module.exports = internals.State = function (stateTrie) {
    this.trie = stateTrie;
};

internals.State.prototype.validateTx = function () {};

internals.State.prototype.addTx = function () {};

internals.State.prototype.loadAccount = function (account) {
    this.trie.get(account);
    //get memory
    //get code
};

internals.State.prototype.validateBlock = function () {};

//pay the miners
internals.State.prototype.processBlock = function (block, root, cb) {
    //pay the miner
    if (arguments.length === 2) {
        cb = root;
        root = null;
    }

    var trie = this.trie;
    trie.checkpoint();
    if (root) trie.root = root;
    var account;

    async.series([
        //get the miners account
        function (callback) {
            trie.get(block.header.coinbase, function (err, rawAccount) {
                account = new Account(rawAccount);
                callback();
            });
        },
        function (callback) {
            //1500 finniy to the miner
            account.balance = bignum.fromBuffer(account.balance).add(bignum(1500).mul(bignum(10).pow(15)));
            trie.put(block.header.coinbase, account, function () {
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
                        uncleAccount.balance = bignum.fromBuffer(account.balance).add(bignum(1500).mul(bignum(10).pow(15)).mul(7).div(8));
                        trie.put(uncle.coinbase, uncleAccount, function () {
                            callback();
                        });
                    }
                ], done);
            }, callback);
        }
    ], function(err){
        if(!err){
            trie.commitCheckpoint(cb);
        }else{
            cb(err);
        }
    });
};
