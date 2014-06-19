var rlp = require("rlp"),
    SHA3 = require("sha3"),
    Transaction = require("./transaction.js"),
    utils = require("./utils.js"),
    internals = {};

internals.Block = module.exports = function (data) {
    this.header = {};
    this.transactions = [];
    this._childHash = null;
    this._inBlockChain = false;
    this.raw = data;
    this.parseBlock(data);
};

/*
 *Produces a hash the RLP of the block
 *@method hash
 */
internals.Block.prototype.hash = function () {
    var hash = new SHA3.SHA3Hash(256);
    hash.update((rlp.encode(this.raw)));
    return hash.digest("hex");
};

/*
 * parses a block
 * @method parseBlock
 * @param {Object} data the data to parses
 */
internals.Block.prototype.parseBlock = function (data) {
    //blocks
    this.header = new internals.BlockHeader(data[0]);
    var rawUncleHeaders = data[2],
        rawTransactions = data[1];

    //parse uncle headers
    for (var i = 0; i < rawUncleHeaders.length; i++) {
        this.uncleHeaders.push(new internals.BlockHeaders(rawUncleHeaders[i]));
    }
    for (var i = 0; i < rawTransactions.length; i++) {
        this.transactions.push(new Transaction(rawTransactions[i]));
    }
};

internals.Block.prototype.rlpSerialize = function () {
    return rlp.encode(this.raw);
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
internals.BlockHeader = function (raw) {

    var self = this;
    this.raw = raw;
    fields = ["parentHash",
        "uncleHash",
        "coinbase",
        "stateRoot",
        "transactionsTrie",
        "difficulty",
        "number",
        "minGasPrice",
        "gasLimit",
        "gasUsed",
        "timestamp",
        "extraData",
        "nonce"
    ];

    fields.forEach(function (field, i) {
        Object.defineProperty(self, field.name, {
            enumerable: true,
            configurable: true,
            get: function () {
                return this.raw[i];
            },
            set: function (v) {
                if (!Buffer.isBuffer(v)) {
                    if (typeof v === "string") {
                        v = new Buffer(v, "hex");
                    } else {
                        v = utils.intToBuffer(v);
                    }
                }
                this.raw[i] = v;
            }
        });
    });
};
