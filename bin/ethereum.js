#!/usr/bin/env node

var Ethereum = require("../"),
    genesis = require("./genesis"),
    networking = require("./networking"),
    levelup = require("levelup"),
    async = require("async");

var internals = {},
    Blockchain = Ethereum.Blockchain,
    stateDB = levelup("./db/state"),
    blockDB = levelup("./db/block"),
    detailsDB = levelup("./db/details");

internals.blockchain = new Blockchain(blockDB, detailsDB);

internals.blockchain.load(function(){
    if (!internals.blockchain.head) {
        console.log("generating genesis block");
        genesis.init(stateDB, internals.blockchain);
    }

    networking.init(internals.blockchain);
});

