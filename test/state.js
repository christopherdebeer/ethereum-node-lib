var async = require('async'),
    Block = require('../lib/block.js'),
    State = require('../lib/state.js'),
    assert = require('assert'),
    levelup = require('levelup'),
    blockFixtures = require('./fixtures/blockSate.json'),
    minerFixtures = require('./fixtures/blockMinnerTx.json');

var internals = {},
    stateDB = levelup('', {
        db: require('memdown')
    });

describe('[State]: Basic functions', function () {
    it('should create a new state', function () {
        internals.state = new State(stateDB);
    });

    it('should generate correct genesis state', function (done) {
        internals.state.generateGenesis(function () {
            var stateRoot = '8dbd704eb38d1c2b73ee4788715ea5828a030650829703f077729b2b613dd206';
            assert(internals.state.trie.root.toString('hex') === stateRoot);
            done();
        });
    });

    it('should process a blocks', function (done) {
        async.eachSeries(blockFixtures, function (rawBlock, cb) {
            var block = new Block(rawBlock.block);
            internals.state.processBlock(block, function (err) {
                assert(internals.state.trie.root.toString('hex') === block.header.stateRoot.toString('hex'));
                cb(err);
            });
        }, done);
    });
});


describe('[State]: Testing case where miner mine\'s its own tx', function () {
    it('should create a new state', function () {
        stateDB = levelup('', {
            db: require('memdown')
        });
        internals.state = new State(stateDB);
    });

    it('should generate correct genesis state', function (done) {
        internals.state.generateGenesis(function () {
            var stateRoot = '8dbd704eb38d1c2b73ee4788715ea5828a030650829703f077729b2b613dd206';
            assert(internals.state.trie.root.toString('hex') === stateRoot);
            done();
        });
    });

    it('should process a blocks', function (done) {
        minerFixtures.pop();
        minerFixtures.reverse();
        async.eachSeries(minerFixtures, function (rawBlock, cb) {
            var block = new Block(rawBlock);
            internals.state.processBlock(block, function (err) {
                assert(internals.state.trie.root.toString('hex') === block.header.stateRoot.toString('hex'));
                cb(err);
            });
        }, done);
    });
});
