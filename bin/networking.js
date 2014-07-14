var async = require('async'),
  Ethereum = require('../'),
  genesis = require('./genesis');

var internals = {},
  Network = Ethereum.Network;


exports.init = function (blockchain, state) {
  console.log('starting networking');
  internals.network = new Network();
  internals.blockchain = blockchain;
  internals.state = state;

  internals.network.on('connecting', function (socket, port, host) {
    console.log('[networking]' + host + ':' + port + ' connecting');
  });

  internals.network.on('closing', function (peer) {
    console.log('[networking]' + peer.internalId + ' closing');
  });

  internals.network.on('message.hello', function (hello, peer) {
    console.log('[networking] ' + hello.ip + ':' + hello.port + ' hello');
    internals.sync(peer, blockchain.head.hash(), function(err){
      console.log('done syncing'); 
    });

   });

  internals.network.on('message.transactions', function (transactions, peer) {
    console.log('[networking]' + peer.internalId + ' got transactions');
    //TODO: check if transaction is in the DB
    //check if the transaction is valid
    //push tx to txlist
    //save in db
  });

  internals.network.on('message.peers', function (peers, peer) {
    console.log(peers);
    console.log('[networking]' + peer.internalId + ' got peers');
  });

  internals.network.on('message.getPeers', function (peers, peer) {
    console.log('[networking]' + peer.internalId + ' got get peers');
  });

  internals.network.on('message.blocks', function (blocks, peer) {


    console.log('[networking]' + peer.internalId + ' got blocks');
  });

  internals.network.on('message.getChain', function (message, peer) {
    console.log(message);
    console.log('[networking]' + peer.internalId + ' got get chain');
  });

  internals.network.on('message.notInChain', function (message, peer) {
    console.log('[networking]' + peer.internalId + ' got not in chain');
  });

  internals.network.on('message.getTransactions', function (message, peer) {
    console.log('[networking]' + peer.internalId + ' got request for transactions');
  });

  internals.network.on('message.disconnect', function (message, peer) {
    console.log('[networking]' + peer.internalId + ' got disconnected:' + message.reason);
  });

  internals.network.on('socket.error', function (e) {
    console.log('[networking] socket error: ' + e);
  });

  internals.network.on('parsing.error', function (e) {
    console.log('[networking] parse error: ' + e);
  });

  internals.network.listen(30303, '0.0.0.0');
  //internals.network.connect(30303, '54.204.10.41');

};

internals.sync = function (peer, startHash, count, cb) {
  var more = true;

  async.whilst(function () {
    return more === true;
  }, function (cb2) {
    internals.blockchain.getBlockHashes(startHash, -5, function (err, hashes) {
      //include the strating hash
      hashes.push(startHash);
      var onMessage = function (msgType, data) {
        if (msgType === 'blocks') {
          if (data.length !== count) {
            more = false;
          }
          peer.on('message.blocks', internals.onBlocks);

          cb2();
        } else if (msgType === 'notInChain') {
          //fetch the last 
          peer.once('message.notInChain', function () {
            if (internals.blockchain.genesisHash.toString('hex') === hashes[0]) {
              //wrong genesis block
              peer.sendDisconnect(0x06, cb2);
            } else {
              //keep trying to synce. Start with the oldest hash
              internals.sync(peer, hashes[0], count, cb2);
            }
          });
        }

        if (msgType === 'blocks' || msgType === 'notInChain') {
          peer.removeListener('message', onMessage);
        }
      };

      if (err) {
        cb2(err);
      } else {
        peer.on('message', onMessage);
        peer.sendGetChain(hashes, count);
      }
    });
  }, cb);
};

internals.onBlock = function (blocks) {
  blocks.forEach(function (block) {
    //get the parent block
    internals.blockchain.getBlock(block.header.parentHash, function (err, parentBlock) {
      if (!parentBlock) {
        console.log('unable to find the block parent\'s');
      } else {
        //validate block here -->

        //proccess the block and  update the world state
        internals.state.processBlock(block, parentBlock.stateRoot, function (err) {
          if (!err) {
            internals.blockchain.addBlock(block, function (err) {
              //probably couldn't find the block
              if (err) {
                console.log('[blockchain] error: ' + err);
              }
            });
          } else {
            console.log('[state] error ' + err);
          }
        });
      }
    });
  });
};
