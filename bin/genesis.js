var Ethereum = require('../'),
    Async = require('async');

var Account = Ethereum.Account,
    Trie = Ethereum.Trie,
    State = Ethereum.State,
    Block = Ethereum.Block,
    rlp = Ethereum.RLP,
    utils = Ethereum.Util,
    internals = {};

exports.init = function (stateDB, blockchain) {
    var state = new State(stateDB); 

    state.generateGenesis(function () {
        var block = new Block();
        block.header.stateRoot = state.trie.root;
        console.log('root: ' + state.trie.root.toString('hex'));
        console.log('rlp: ' + block.serialize().toString('hex'));
        console.log('hash: ' + block.hash());
        blockchain.addBlock(block);
    });
};
