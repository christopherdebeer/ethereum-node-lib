var async = require("asyc"),
    Ethereum = require("../"),
    genesis = require("./genesis");

var internals = {},
    Network = Ethereum.Network;


exports.init = function (blockchain, state) {
    console.log("starting networking");
    internals.network = new Network();

    internals.network.on("connecting", function (socket, port, host) {
        console.log("[networking]" + host + ":" + port + " connecting");
    });

    internals.network.on("closing", function (peer) {
        console.log("[networking]" + peer.internalId + " closing");
    });

    internals.network.on("message.hello", function (hello, peer) {
        console.log("[networking] " + hello.ip + ":" + hello.port + " hello");
        var more = true;
        async.whilst(function () {
            return more === true;
        }, function (done) {
            var hashes = blockchain.getBlockHashes(3, function () {
                peer.sendGetChain(hashes, 30);
                peer.one("message.blocks", function (blocks) {
                    if (blocks.length !== 30) {
                        more = false;
                    }
                    done();
                });
            });
        });
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
            //get the parent block
            blockchain.getBlock(block.header.parentHash, function (err, parentBlock) {
                if (!parentBlock) {
                    var incomingHeight = block.header.number,
                        height = blockchain.head.header.number;

                    if (incomingHeight > height) {
                        peer.sendGetChain(blockchain.hash(), incomingHeight - height);
                    } else {
                        blockchain.getChain(blockchain.genesis, incomingHeight, function (foundBlocks) {
                            peer.sendGetChain(foundBlocks, incomingHeight);
                        });
                    }
                } else {
                    //proccess the block and  update the world state
                    state.processBlock(block, parentBlock.stateRoot, function (err) {
                        if (!err) {
                            blockchain.addBlock(block, function (err) {
                                //probably couldn't find the block
                                if (err) {
                                    console.log("[blockchain] error: " + err);
                                }
                            });
                        } else {
                            console.log("[state] error " + err);
                        }
                    });
                }
            });

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
};
