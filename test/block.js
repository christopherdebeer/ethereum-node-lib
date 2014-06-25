var Block = require("../lib/block.js"),
    blockFixtures = require("./fixtures/blocks.json"),
    assert = require("assert");

describe("[Block]: Basic functions", function () {
    var blocks = [];
    it("should parse a block", function () {
        blockFixtures.forEach(function (rawBlock) {
            var block = new Block(rawBlock.block);
            blocks.push(block);
        });
    });

    it("should serialize data", function () {
        blocks.forEach(function (block, i) {
            assert(block.serialize().toString("hex") === blockFixtures[i].serialized);
        });
    });

    it("should create a hash", function () {
        blocks.forEach(function (block, i) {
            assert(block.hash().toString("hex") === blockFixtures[i].hash);
        });
    });
});
