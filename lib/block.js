var rlp = require("rlp"),
    SHA3 = require("sha3"),
    Transaction = require("./transaction.js"),
    utils = require("./utils.js"),
    internals = {};

internals.Block = module.exports = function (data) {
    this.header = {};
    this.transactions = [];
    this.uncleHeaders = [];
    this._childHash = null;
    this._inBlockChain = false;
    this.parseBlock(data);
};

/*
 * parses a block
 * @method parseBlock
 * @param {Object} data the data to parses
 */
internals.Block.prototype.parseBlock = function (data) {
    //blocks

    if (!data) {
        data = [
            [],
            [],
            []
        ];
    }
    this.header = new internals.BlockHeader(data[0]);
    var rawTransactions = data[1],
        rawUncleHeaders = data[2];

    //parse uncle headers
    for (var i = 0; i < rawUncleHeaders.length; i++) {
        this.uncleHeaders.push(new internals.BlockHeaders(rawUncleHeaders[i]));
    }
    //parse transactions
    for (var i = 0; i < rawTransactions.length; i++) {
        this.transactions.push(new Transaction(rawTransactions[i]));
    }
};

/*
 *Produces a hash the RLP of the block
 *@method hash
 */
internals.Block.prototype.hash = function () {
    var hash = new SHA3.SHA3Hash(256);
    hash.update(this.serialize());
    return hash.digest("hex");
};


internals.Block.prototype.serialize = function () {
    var raw = [this.header.raw, [],
        []
    ];
    this.transactions.forEach(function (tx) {
        raw[1].push(tx.raw);
    });

    this.uncleHeaders.forEach(function (uncle) {
        raw[2].push(uncle.raw);
    });

    return rlp.encode(raw);
};

internals.Block.prototype.inBlockchain = function () {
    return this._inBlockChain;
};

internals.Block.prototype.getChildHash = function () {
    return this._childHash;
};

/*
 * Block Header
 */
internals.BlockHeader = function (data) {
    var fields = [{
            name: "parentHash",
            length: 32
        }, {
            name: "uncleHash",
            length: 32
        }, {
            name: "coinbase",
            length: 20
        }, {
            name: "stateRoot",
            length: 32
        },
        "transactionsTrie",
        "difficulty",
        "number",
        "minGasPrice",
        "gasLimit",
        "gasUsed",
        "timestamp",
        "extraData", {
            name: "nonce",
            length: 32
        }
    ];

    var hash = new SHA3.SHA3Hash(256);
    hash.update(new Buffer([42]));
    this.raw = [
        utils.zero256(), //parent
        utils.emptyRlpHash(), //uncles
        utils.zero160(), //coinbase
        utils.zero256(), //parent
        new Buffer([0]), //trasacntionsTrie
        utils.intToBuffer(Math.pow(2, 22)), //difficulty
        new Buffer([0]), //number
        new Buffer([0]), //minGasPrice
        utils.intToBuffer(1000000), //gasLimit
        new Buffer([0]),
        new Buffer([0]),
        new Buffer([0]),
        new Buffer(hash.digest("hex"), "hex")
    ];

    //make sure all the items are buffers
    data.forEach(function (d, i) {
        this.raw[i] = typeof d === "string" ? new Buffer(d, "hex") : d;
    });

    utils.validate(fields, this.raw);
    utils.defineProperties(this, fields);
};
