var assert = require('assert'),
    Blockchain = require('../lib/blockchain.js'),
    levelup = require('levelup'),
    blockFixtures = require('./fixtures/blocks.json'),
    async = require('async');

var blockDB = levelup('', {
    db: require('memdown')
}),
    detailsDB = levelup('/does/not/matter', {
        db: require('memdown')
    }),
    internals = {};

describe('[Blockchain]: Basic functions', function () {
    it('should create a new block chain', function (done) {
        internals.blockchain = new Blockchain(blockDB, detailsDB);
        internals.blockchain.init(done);
    });

    it('should add blocks', function (done) {
        async.eachSeries(blockFixtures, function (rawBlock, callback) {
            internals.blockchain.addBlock(rawBlock.block, callback);
        }, done);
    });

    it('should fetch hashes from the chain', function (done) {
        internals.blockchain.getBlockHashes(blockFixtures[1].hash, 2, function (errs, hashes) {
            assert(hashes.length === 2);
            assert(blockFixtures[3].hash === hashes[0]);
            assert(blockFixtures[2].hash === hashes[1]);
            done();
        });
    });

    it('should fetch hashes even when less hashes exist in the chain then asked for', function (done) {
        internals.blockchain.getBlockHashes(blockFixtures[1].hash, 9, function (errs, hashes) {
            assert(hashes.length === 4);
            assert(blockFixtures[5].hash === hashes[0]);
            assert(blockFixtures[4].hash === hashes[1]);
            done();
        });
    });

    it('should fetch hashes from the chain backwards', function (done) {
        internals.blockchain.getBlockHashes(blockFixtures[4].hash, -2, function (errs, hashes) {
            assert(hashes.length === 2);
            assert(blockFixtures[3].hash === hashes[0]);
            assert(blockFixtures[2].hash === hashes[1]);
            done();
        });
    });

    it('should fetch hashes from the chain backwards', function (done) {
        internals.blockchain.getBlockHashes(blockFixtures[4].hash, -8, function (errs, hashes) {
            assert(hashes.length === 4);
            assert(blockFixtures[3].hash === hashes[0]);
            assert(blockFixtures[2].hash === hashes[1]);
            done();
        });
    });

});
