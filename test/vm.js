var async = require('async'),
    VM = require('../lib/vm'),
    Account = require('../lib/account.js'),
    Tx = require('../lib/transaction.js'),
    assert = require('assert'),
    levelup = require('levelup'),
    Trie = require('merkle-patricia-tree'),
    vmTests = require('./fixtures/vmTests.json');

var internals = {},
    stateDB = levelup('', {
        db: require('memdown')
    });

internals.state = new Trie(stateDB);

describe('[VM]: Basic functions', function () {

    it('setup the trie', function (done) {
        var test = vmTests.txTest;
        var account = new Account(test.preFromAccount);
        internals.state.put(new Buffer(test.from, 'hex'), account.serialize(), done);
    });

    it('it should run a transaction', function (done) {
        var test = vmTests.txTest;
        var vm = new VM({
            trie: internals.state
        });

        vm.runTx(new Tx(test.tx), function (err, results) {
            assert(results.gasUsed.toNumber() === test.gasUsed, 'invalid gasUsed amount');
            assert(results.fromAccount.raw[0].toString('hex') === test.postFromAccount[0], 'invalid nonce on from account');
            assert(results.fromAccount.raw[1].toString('hex') === test.postFromAccount[1], 'invalid balance on from account');
            assert(results.toAccount.raw[1].toString('hex') === test.postToAccount[1], 'invalid balance on to account');
            done(err);
        });
    });

    it('it should generate new contract address correctly', function (done) {
        var test = vmTests.memoryTest;
        var account = new Account(test.fromAccount);
        var tx = new Tx(test.tx);
        assert(VM.generateAddress(tx.getSenderAddress(), account.nonce) === test.newAddress);
        done();
    });

    it('it should run a contract the accesses storage', function (done) {
        var test = vmTests.memoryTest;
        var vm = new VM({
            trie: internals.state
        });

        vm.runTx(new Tx(test.tx), function (err, results) {
            assert(results.gasUsed.toNumber() === test.gasUsed, 'invalid gasUsed amount');
            assert(results.vm.storage.toString('hex') === test.postToAccount[2], 'invalid storage state root');
            assert(results.fromAccount.raw[0].toString('hex') === test.postFromAccount[0], 'invalid nonce on from account');
            assert(results.fromAccount.raw[1].toString('hex') === test.postFromAccount[1], 'invalid balance on from account');
            assert(results.toAccount.raw[1].toString('hex') === test.postToAccount[1], 'invalid balance on to account');
            assert(results.toAccount.raw[3].toString('hex') === test.postToAccount[3], 'invaid code hash');
            done(err);
        });
    });

    it('setup the trie for codycopy test', function (done) {
        stateDB = levelup('', {
            db: require('memdown')
        });

        internals.state = new Trie(stateDB);

        var test = vmTests.codeCopy;
        var account = new Account(test.preFromAccount);
        internals.state.put(new Buffer(test.from, 'hex'), account.serialize(), done);
    });

    it('it should run a contract using `codeCopy`', function (done) {
        var test = vmTests.codeCopy;
        var vm = new VM({
            trie: internals.state
        });

        var tx = new Tx(test.tx);
        vm.runTx(tx, function (err, results) {
            assert(results.gasUsed.toNumber() === test.gasUsed, 'invalid gasUsed amount');
            assert(results.fromAccount.raw[0].toString('hex') === test.postFromAccount[0], 'invalid nonce on from account');
            assert(results.fromAccount.raw[1].toString('hex') === test.postFromAccount[1], 'invalid balance on from account');
            assert(results.toAccount.raw[1].toString('hex') === test.postToAccount[1], 'invalid balance on to account');
            assert(results.toAccount.raw[2].toString('hex') === test.postToAccount[2], 'invaid state root');
            assert(results.toAccount.raw[3].toString('hex') === test.postToAccount[3], 'invaid code hash');
            done(err);
        });
    });

    it('it should call vai a message to a contract correctly', function (done) {
        var test = vmTests.messageCall;
        var vm = new VM({
            trie: internals.state
        });

        var tx = new Tx(test.tx);
        vm.runTx(tx, function (err, results) {
            assert(results.gasUsed.toNumber() === test.gasUsed, 'invalid gasUsed amount');
            assert(results.fromAccount.raw[0].toString('hex') === test.postFromAccount[0], 'invalid nonce on from account');
            assert(results.fromAccount.raw[1].toString('hex') === test.postFromAccount[1], 'invalid balance on from account');
            assert(results.toAccount.raw[1].toString('hex') === test.postToAccount[1], 'invalid balance on to account');
            assert(results.toAccount.raw[2].toString('hex') === test.postToAccount[2], 'invaid state root');
            assert(results.toAccount.raw[3].toString('hex') === test.postToAccount[3], 'invaid code hash');
            done(err);
        });
    });

    it('it should run the CALL op code', function (done) {
        var test = require('./fixtures/vm/call.json');
        stateDB = levelup('', {
            db: require('memdown')
        });

        internals.state = new Trie(stateDB);

        async.each(test.preAccounts, function (accountInfo, done) {
            var account = new Account(accountInfo.account);

            async.parallel([
                async.apply(internals.state.put.bind(internals.state), new Buffer(accountInfo.address, 'hex'), account.serialize()),
                function (done2) {
                    if (accountInfo.code) {
                        internals.state.db.put(account.codeHash, new Buffer(accountInfo.code, 'hex'), {
                            encoding: 'binary'
                        }, done2);
                    } else {
                        done2();
                    }
                },
                function (done2) {
                    var memTrie  = new Trie(stateDB);
                    if (accountInfo.memory) {
                        async.each(accountInfo.memory, function(mem, done3){
                            memTrie.put(new Buffer(mem.key, 'hex'), new Buffer(mem.value, 'hex'), done3);
                        }, function(){
                            done2();
                        });
                    } else {
                        done2();
                    }
                }

            ], done);

        }, function () {

            var vm = new VM({
                trie: internals.state
            });

            var tx = new Tx(test.tx);


            vm.runTx(tx, function (err, results) {
                assert(results.gasUsed.toNumber() === test.gasUsed, 'invalid gasUsed amount');
                // assert(results.fromAccount.raw[0].toString('hex') === test.postFromAccount[0], 'invalid nonce on from account');
                // assert(results.fromAccount.raw[1].toString('hex') === test.postFromAccount[1], 'invalid balance on from account');
                // assert(results.toAccount.raw[1].toString('hex') === test.postToAccount[1], 'invalid balance on to account');
                // assert(results.toAccount.raw[2].toString('hex') === test.postToAccount[2], 'invaid state root');
                // assert(results.toAccount.raw[3].toString('hex') === test.postToAccount[3], 'invaid code hash');
                done(err);
            });

        });

    });
});
