var Ethereum = require("../"),
    Async = require("async");


var Account = Ethereum.Account,
    Trie = Ethereum.Trie,
    Block = Ethereum.Block,
    rlp = Ethereum.RLP,
    utils = Ethereum.Util,
    internals = {};


var addresses = [
    "1a26338f0d905e295fccb71fa9ea849ffa12aaf4",
    "1e12515ce3e0f817a4ddef9ca55788a1d66bd2df",
    "2ef47100e0787b915105fd5e3f4ff6752079d5cb",
    "51ba59315b3a95761d0863b05ccc7a7f54703d99",
    "6c386a4b26f73c802f34673f7248bb118f97424a",
    "cd2a3d9f938e13cd947ec05abc7fe734df8dd826",
    "e4157b34ea9615cfbde6b4fda419828124b70c78",
    "e6716f9544a56c530d868e4bfbacb172315bdead"
];

exports.init = function (stateDB, blockchain) {
    var trie = new Trie(stateDB);
    Async.eachSeries(addresses, function (address, done) {
        var account = new Account(),
            startAmount = new Buffer(26);
        startAmount.fill(0);
        startAmount[0] = 1;
        account.balance = startAmount;

        trie.put(new Buffer(address, "hex"), account.serialize(), function () {
            done();
        });

    }, function () {
        var block = new Block();
        block.header.stateRoot = trie.root;
        console.log("root: " + trie.root.toString("hex"));
        console.log("rlp: " + block.serialize().toString("hex"));
        console.log("hash: " + block.hash());
        //blockchain.addBlock(block);
    });
};
