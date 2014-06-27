var Block = require('../lib/block.js'),
    blockFixtures = require('./fixtures/blocks.json'),
    assert = require('assert');

describe('[Block]: Basic functions', function () {
    var blocks = [];
    it('should parse a block', function () {
        blockFixtures.forEach(function (rawBlock) {
            var block = new Block(rawBlock.block);
            blocks.push(block);
        });
    });

    it('should serialize data', function () {
        blocks.forEach(function (block, i) {
            assert(block.serialize().toString('hex') === blockFixtures[i].serialized);
        });
    });

    it('should create a hash', function () {
        blocks.forEach(function (block, i) {
            assert(block.hash().toString('hex') === blockFixtures[i].hash);
        });
    });

    it('should validate POW', function () {
        //the genesis block does not have a valid POW
        blocks.splice(0, 1);
        blocks.forEach(function (block) {
            assert(block.header.validatePOW());
        });
    });

    it('should validate difficulty', function () {
        //the genesis block does not have a valid POW
        blocks.forEach(function (block, i) {
            assert(block.header.validateDifficulty(new Block(blockFixtures[i].block)));
        });
    });

    it('should validate the whole blockheader', function () {
        //the genesis block does not have a valid POW
        blocks.forEach(function (block, i) {
            assert(block.header.validate(new Block(blockFixtures[i].block)));
        });
    });

    it('should validate the whole block', function () {
        //the genesis block does not have a valid POW; note we have no uncles
        //so we don't need the parnet's parent
        blocks.forEach(function (block, i) {
            assert(block.validate(new Block(blockFixtures[i].block)));
        });
    });
});
