#!/usr/bin/env node

var Ethereum = require('../'),
  genesis = require('./genesis'),
  networking = require('./networking'),
  levelup = require('levelup'),
  async = require('async');

var internals = {},
  Blockchain = Ethereum.Blockchain,
  State = Ethereum.State,
  Utils = Ethereum.Utils,
  stateDB = levelup('./db/state'),
  blockDB = levelup('./db/block'),
  detailsDB = levelup('./db/details');

var argv = require('minimist')(process.argv.slice(2));
if (argv.help) {
  console.log('TODO: write help');
} else {
  internals.blockchain = new Blockchain(blockDB, detailsDB);
  internals.state = new State(stateDB);

  internals.blockchain.init(function () {
    if (!internals.blockchain.head) {
      console.log('generating genesis block');
      genesis.init(stateDB, internals.blockchain);
    }
    if (!argv.dumpbc) {
      networking.init(internals.blockchain, internals.state);
    } else {
      var hash = internals.blockchain.genesisHash;
      internals.blockchain.getBlockChain([hash], 30, function (err, results) {
        results = results.map(function(b){
          return b.serialize(false);
        });
        console.log(Utils.bufferToJSON(results));
      });
    }
  });
}
