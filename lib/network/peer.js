var util = require("util"),
    assert = require("assert"),
    domain = require("domain"),
    EventEmitter = require("events")
        .EventEmitter,
    RLP = require("rlp"),
    _ = require("underscore"),
    etherUtils = require("../utils"),
    logic = require("./logic.js"),
    Block = require("../block.js"),
    Transaction = require("../transaction.js");

    var internals = {};

internals.PROTOCOL_VERSION = {
    0x00: "PoC-1",
    0x01: "PoC-2",
    0x07: "PoC-3",
    0x08: "PoC-3.5",
    0x0b: "PoC-4",
    0x14: "Poc-5"
};

//make static
Object.freeze(internals.PROTOCOL_VERSION);

internals.DISCONNECT_REASON = {
    0x00: "Disconnect requested",
    0x01: "TCP sub-system error",
    0x02: "Bad protocol",
    0x03: "Useless peer",
    0x04: "Too many peers",
    0x05: "Already connected",
    0x06: "Wrong genesis block",
    0x07: "Incompatible network protocols",
    0x08: "Client quitting"
};
//make static
Object.freeze(internals.DISCONNECT_REASON);

/*
 * @contructor
 * @param {Object} socket an Intialized Sockets. MUST alread be connected
 * @param {Object} network the network that initailized the connection
 */
exports = module.exports = internals.Peer = function (socket, network) {


    // Register as event emitter
    EventEmitter.call(this);

    this.socket = socket;
    this.network = network;

    //the state of the peer
    this._state = {
        hello: false //has the handshake took place?
    };

    //create an id internall book keeping
    this.internalId = this.id = socket.remoteAddress + ":" + socket.remotePort;

    var self = this;
    socket.on("error", function (e) {
        self.emit("socet.error", e);
    });

    socket.on("data", function (data) {

        while (data.length) {
            var parsedData = false;

            try {
                var payloadLen = parseInt(data.slice(4, 8).toString("hex"), 16),
                    payload = RLP.decode(data.slice(8, payloadLen + 8));

                assert.equal(self.network.SYNC_TOKEN, data.slice(0, 4)
                    .toString("hex"), "Invalid Sync Token");
                data = data.slice(payloadLen + 8);
                parsedData = self._parsePayload(payload);

            } catch (e) {
                data = []; //stop the while
                self.emit("parsing.error", e);
                self.sendDisconnect(0x02);
            }

            if (parsedData) {
                parsedData[0] = "message." + parsedData[0];
                self.emit.apply(self, parsedData);
                parsedData.push(self);
                self.network.emit.apply(self.network, parsedData);
            }
        }
    });

    //bind the peer logic
    logic.logic(this);
};

util.inherits(internals.Peer, EventEmitter);

/*
 * formats packets as a 4-byte synchronisation token (0x22400891), a 4-byte
 * "payload size", to be interpreted as a big-endian integer and finally an
 * N-byte RLP-serialised data structure, where N is the aforementioned
 * "payload size".
 * @method sendMessage
 * @param {Object} message a the message that is being sent
 * @param {Function} cb a callback function
 */
internals.Peer.prototype.sendMessage = function (message, cb) {
    var payload = RLP.encode(message),
        len = new Buffer(4);

    len.writeUInt32BE(payload.length, 0);
    var formatedPayload = Buffer.concat([new Buffer(this.network.SYNC_TOKEN, "hex"), len, payload]);
    this.socket.write(formatedPayload, cb);
};

/*
 * Sends the hello message
 * @method sendHello
 */
internals.Peer.prototype.sendHello = function (cb) {
    var message = [
        null,
        this.network.PROTOCOL_VERSION,
        null,
        this.network.CLIENT_ID,
        this.network.CAPABILITIES,
        this.network.port,
        new Buffer(this.network.NODE_ID, "hex")
    ];
    this.sendMessage(message, cb);
};

/*
 * Inform the peer that a disconnection is imminent
 * @method sendDisconnect
 * @param {Number} reason
 * @param {Function} cb
 */
internals.Peer.prototype.sendDisconnect = function (reason, cb) {
    var self = this;
    this.sendMessage([0x01, reason], function () {
        self.socket.end();
        if (_.isFunction(cb)) {
            cb();
        }
    });
};

/*
 * Requests an immediate reply of Pong from the peer
 * @method sendPing
 * @param {Function} cb
 */
internals.Peer.prototype.sendPing = function (cb) {
    this.sendMessage([0x02], cb);
};


/*
 * Reply to peer"s Ping packet
 * @method sendPong
 * @param {Function} cb
 */
internals.Peer.prototype.sendPong = function (cb) {
    this.sendMessage([0x03], cb);
};

/*
 * Request the peer to enumerate some known peers for us to connect to. This
 * should include the peer itself.
 * @method sendGetPeers
 * @param {Function} cb
 */
internals.Peer.prototype.sendGetPeers = function (cb) {
    this.sendMessage([0x10], cb);
};

/*
 * Specifies a number of known peers
 * @method sendPeers
 * @param {Function} cb
 */
internals.Peer.prototype.sendPeers = function (cb) {
    if (this.network.options.peerDiscovery) {
        var peers = this.network.getPeers();
        //inculde thy self
        peers.push(this.network);
        peers = internals.encodePeers(peers);
        peers.unshift(0x11);
        this.sendMessage(peers, cb);
    } else {
        return false;
    }
};


/*
 * Specify (a) transaction(s) that the peer should make sure is included on its
 * transaction queue.
 * @method sendTransactions
 * @param {Function} cb
 */
internals.Peer.prototype.sendTransactions = function (transactions, cb) {
    if (this.network.options.transactionRelaying) {
        this.sendMessage([0x12], cb);
    } else {
        return false;
    }

};

/*
 * Specify (a) block(s) that the peer should know about.
 * @method sendBlocks
 * @param {Function} cb
 */
internals.Peer.prototype.sendBlocks = function (blocks, cb) {
    if (this.network.options.blockchainQuerying) {
        this.sendMessage([0x13], cb);
    } else {
        return false;
    }
};

/*
 * Request the peer to send Count (to be interpreted as an integer) blocks in
 * the current canonical block chain that are children of Parent1
 * @method sendGetChain
 * @param {Function} cb
 */
internals.Peer.prototype.sendGetChain = function (parents, count, cb) {
    this.sendMessage([0x14, 0x10], cb);
};

/*
 * Tell the peer that the given hash was not found in its block chain.
 * @method sendNotInChain
 * @param {Function} cb
 */
internals.Peer.prototype.sendNotInChain = function (cb) {
    this.sendMessage([0x15], cb);
};

/*
 * Request the peer to send all transactions currently in the queue
 * @method sendGetTransactions
 * @param {Function} cb
 */
internals.Peer.prototype.sendGetTransactions = function (cb) {
    this.sendMessage([0x16], cb);
};

internals.Peer.prototype._parsePayload = function (payload) {

    switch (payload[0][0]) {
    case undefined:
    case 0x00:
        //hello
        //build hello message
        var hello = internals.parseHello.call(this, payload);
        return ["hello", hello];

    case 0x01:
        //disconnect
        var message = {
            reason: internals.DISCONNECT_REASON[payload[1]]
        };

        return ["disconnect", message];
    case 0x02:
        //ping
        return ["ping", {}];
    case 0x03:
        //pong
        return ["pong", {}];
    case 0x10:
        //get peers
        return ["getPeers", {}];
    case 0x11:
        //peers
        var message = internals.parsePeers(payload);
        //format message
        return ["peers", message];

    case 0x12:
        //transactions
        printBA(payload);
        var message = internals.parseTxs(payload);
        return ["transactions", message];

    case 0x13:
        //blocks
        printBA(payload);
        var message = internals.parseBlocks(payload);
        return ["blocks", message];

    case 0x14:
        //get chain
        var message = {
            parents: []
        };

        for (var i = 1; i < payload.length - 1; i++) {
            message.parents.push(payload[i]);
        }

        message.count = payload[payload.length - 1];
        return ["getChain", message];

    case 0x15:
        //not in chain
        return ["notInChain", {}];

    case 0x16:
        //get transactions
        return ["getTransactions", {}];

    default:
        //bad protocol
        throw ("invalid message id");
    }
}

internals.parseBlocks = function (payload) {
    //blocks
    var blocks = [];
    for (var i = 1; i < payload.length; i++) {
        printBA(payload[i]);
        blocks.push(new Block(payload[i]));
    }
    return blocks;
};

internals.parseHello = function (payload) {
    //hello
    //build hello message
    var binaryCaps = payload[4][0],
    capabilities = {
        blockchainQuerying: Boolean(1 & binaryCaps),
        peerDiscovery: Boolean(2 & binaryCaps),
        transactionRelaying: Boolean(4 & binaryCaps)
    },
    hello = {
        protocolVersion: internals.PROTOCOL_VERSION[payload[1][0]],
        networkId: payload[2].toString(),
        clientId: payload[3].toString(),
        capabilities: capabilities,
        port: etherUtils.bufferToInt(payload[5]), 
        nodeId: payload[6].toString("hex"),
        ip: this.socket.remoteAddress
    };
    return hello;
};

//parses an array of transactions
internals.parseTxs = function (payload) {
    var txs = [];
    for (var i = 1; i < payload.length; i++) {
        txs.push(new Transaction(payload[i]));
    }
    return txs;
};

internals.parsePeers = function (payload) {
    var message = [];
    //format message
    for (var i = 1; i < payload.length; i++) {
        var peer = payload[i];
        var peerObject = {
            ip: peer[0][0] + "." + peer[0][1] + "." + peer[0][2] + "." + peer[0][3],
            port: peer[1].readUInt16BE(0),
            id: peer[2].toString("hex")
        };
        peerObject.internalId = peerObject.ip + ":" + peerObject.port;
        message.push(peerObject);
    }
    return message;
};

internals.encodePeers = function (peers) {
    var peerArray = [];
    peers.forEach(function(peer){
        if (peer.ip) {
            var ip = new Buffer(peer.ip.split("."));
            var port = new Buffer(2);
            port.writeUInt16BE(peer.port, 0);
            var id = new Buffer(peer.id, "hex");
            peerArray.push([ip, port, id]);
        }
    });
    return peerArray;
};

/*
 * debugging function, Prints a buffer array
 */
var printBA = function (ba) {
    if (Buffer.isBuffer(ba)) {
        if (ba.length === 0) {
            console.log("new Buffer(0)");
        } else {
            console.log("new Buffer(\"" + ba.toString("hex") + "\", \"hex\")");
        }
    } else if (ba instanceof Array) {
        console.log("[");
        for (var i = 0; i < ba.length; i++) {
            printBA(ba[i]);
            console.log(",");
        }
        console.log("]");
    } else {
        console.log(ba);
    }
};
