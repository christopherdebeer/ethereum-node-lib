var async = require('async'),
    Ethereum = require('../'),
    genesis = require('./genesis');

var internals = {},
    Network = Ethereum.Network,
    Utils = Ethereum.Utils;


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
        internals.sync(peer, blockchain.head.hash(), function (err) {
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
        internals.onBlock(blocks);
    });

    internals.network.on('message.getChain', function (message, peer) {
        console.log(message);
        console.log('[networking]' + peer.internalId + ' got get chain');
    });

    internals.network.on('message.notInChain', function (message, peer) {
        console.log('[networking]' + peer.internalId + ' got not in chain');
    });

    internals.network.on('message.getTransactions', function (message, peer) {
        console.log(Utils.bufferToJSON(message.raw));
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

/**
 * Syncs blockchain with a peer
 * @method sync
 * @param {Object} peer
 * @param {String} startHash - the block hash to start the sync from
 * @param {Interger} count - the number of blocks to fetch per request
 * @param {Function} cb - the callback
 */
internals.sync = function (peer, startHash, cb) {
    var more = true,
        count = 30; //how mainly blocks to get.

    //get the first five hashes
    internals.blockchain.getBlockHashes(startHash, -5, function (err, hashes) {
        async.whilst(function () {
            return more;
        }, function (cb2) {
            //include the strating hash
            hashes.unshift(startHash);
            var onMessage = function (msgType, data) {
                if (msgType === 'blocks' || msgType === 'notInChain') {
                    peer.removeListener('message', onMessage);
                }

                if (msgType === 'blocks') {
                    if (data.length !== count) {
                        more = false;
                    }

                    cb2();
                } else if (msgType === 'notInChain') {
                    //fetch the last 
                    peer.once('message.notInChain', function () {
                        if (internals.blockchain.genesisHash.toString('hex') === hashes[0]) {
                            //wrong genesis block
                            peer.sendDisconnect(0x06, cb2);
                        } else {
                            //keep trying to synce. Start with the oldest hash
                            internals.sync(peer, hashes.pop(), cb2);
                        }
                    });
                }
            };

            if (err) {
                cb2(err);
            } else {
                peer.on('message', onMessage);
                peer.sendGetChain(hashes, count);
            }
        }, cb);
    });
};

/**
 * process a block and adds to the blockchain
 * @method onBlock
 */
internals.onBlock = function (blocks) {
    blocks.reverse();
    async.eachSeries(blocks, function (block, cb) {
        //TODO: get the parent block root state if parent is not head
        //validate block here -->
        //proccess the block and  update the world state
        console.log('adding block: ' + block.hash().toString('hex'));
        if (block.transactionReceipts[0]) {
            console.log('tx: ' + Utils.bufferToJSON(block.transactionReceipts[0].transaction.raw));
        }
        async.series([
            async.apply(block.genTxTrie.bind(block)),
            function (cb2) {
                if (block.validate(internals.blockchain.head)) {
                    internals.state.processBlock(block, internals.blockchain.head.header.stateRoot, cb2);
                } else {
                    cb2('invalid block');
                }
            },
            async.apply(internals.blockchain.addBlock.bind(internals.blockchain), block)
        ], function (err) {
            if (err) {
                console.log('error processing block: ' + err);
            }
            cb(err);
        });
    });
};
