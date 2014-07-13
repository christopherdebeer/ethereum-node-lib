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

describe.only('[State]: Basic functions', function () {
    it('should create a new state', function () {
        internals.state = new State(stateDB);
    });

    it('should generate correct genesis state', function (done) {
        internals.state.generateGenesis(function () {
            var stateRoot = '11cc4aaa3b2f97cd6c858fcc0903b9b34b071e1798c91645f0e05e267028cb4a';
            assert(internals.state.trie.root.toString('hex') === stateRoot);
            done();
        });
    });

    it('should process a blocks', function (done) {
        blockFixtures.splice(0, 1);
        async.eachSeries(blockFixtures, function (rawBlock, cb) {
            var block = new Block(rawBlock.block);
            internals.state.processBlock(block, function () {
                assert(internals.state.trie.root.toString('hex') === block.header.stateRoot.toString('hex'));
                cb();
            });
        }, done);
    });

    // it('should dump state', function (done) {
    //     var rlp = require('rlp');
    //     var stream = internals.state.trie.createReadStream();

    //     stream.on('data', function (data) {
    //         console.log(data.key.toString('hex'));
    //         console.log(rlp.decode(data.value));
    //     });
    //     stream.on('end', function () {
    //         done();
    //     });
    // });
});
