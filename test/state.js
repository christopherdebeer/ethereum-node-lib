var async = require('async'),
    Block = require('../lib/block.js'),
    State = require('../lib/state.js'),
    assert = require('assert'),
    levelup = require('levelup'),
    blockFixtures = require('./fixtures/blocks.json');

var internals = {},
    stateDB = levelup('', {
        db: require('memdown')
    });

describe('[State]: Basic functions', function () {
    it('should create a new state', function () {
        internals.state = new State(stateDB);
    });

    it('should have correct genesis', function (done) {
        internals.state.generateGenesis(function () {
            var stateRoot = '11cc4aaa3b2f97cd6c858fcc0903b9b34b071e1798c91645f0e05e267028cb4a';
            assert(internals.state.trie.root.toString('hex') === stateRoot);
            done();
        });
    });

    it('should process a blocks', function (done) {
        blockFixtures.splice(0, 1);
        blockFixtures.splice(-1);
        async.eachSeries(blockFixtures, function (rawBlock, cb) {
            var block = new Block(rawBlock.block);
            internals.state.processBlock(block, function () {
                assert(internals.state.trie.root.toString('hex') === block.header.stateRoot.toString('hex'));
                cb();
            });
        }, done);
    });
});
