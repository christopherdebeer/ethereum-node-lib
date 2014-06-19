#!/usr/bin/env node

var Ethereum = require("../"),
    genesis = require("./genesis"),
    levelup = require("levelup"),
    async = require("async");

var internals = {},
    Network = Ethereum.Network,
    Blockchain = Ethereum.Blockchain,
    stateDB = levelup("./db/state"),
    blockDB = levelup("./db/block"),
    detailsDB = levelup("./db/details");

internals.blockchain = new Blockchain(blockDB, detailsDB);

internals.blockchain.load(function(){
    if (!this.head) {
        genesis.init(stateDB, internals.blockchain);
    }
});

internals.network = new Network();

internals.network.on("connecting", function (socket, port, host) {
    console.log("[networking]" + host + ":" + port + " connecting");
});

internals.network.on("closing", function (peer) {
    console.log("[networking]" + peer.internalId + " closing");
});

internals.network.on("message.hello", function (hello) {
    console.log("[networking]" + hello.ip + ":" + hello.port + " hello");
});

internals.network.on("message.transactions", function (transactions, peer) {
    console.log("[networking]" + peer.internalId + " got transactions");
    //TODO: check if transaction is in the DB
    //check if the transaction is valid
    //push tx to txlist
    //save in db
});

internals.network.on("message.peers", function (peers, peer) {
    console.log(peers);
    console.log("[networking]" + peer.internalId + " got peers");
});

internals.network.on("message.getPeers", function (peers, peer) {
    console.log("[networking]" + peer.internalId + " got get peers");
});

internals.network.on("message.blocks", function (blocks, peer) {

    blocks.forEach(function (block) {
        // if(internals.blockchain.verify(block)){
        //     internals.head = internals.blockchain.head;
        //     internals.state.verify(block, function(err){
        //         if(!err){
        //             internals.blockchain.save(block);
        //             internals.state.commit();
        //         }
        //     });
        // }
    });

    console.log("[networking]" + peer.internalId + " got blocks");
});

internals.network.on("message.getChain", function (message, peer) {
    console.log("[networking]" + peer.internalId + " got get chain");
});

internals.network.on("message.notInChain", function (message, peer) {
    console.log("[networking]" + peer.internalId + " got not in chain");
});

internals.network.on("message.getTransactions", function (message, peer) {
    console.log("[networking]" + peer.internalId + " got request for transactions");
});

internals.network.on("message.disconnect", function (message, peer) {
    console.log("[networking]" + peer.internalId + " got disconnected:" + message.reason);
});

internals.network.on("socket.error", function (e) {
    console.log("[networking] socket error: " + e);
});

internals.network.on("parsing.error", function (e) {
    console.log("[networking] parse error: " + e);
});

internals.network.listen(30303, "0.0.0.0");
//internals.network.connect(30303, "54.204.10.41");
