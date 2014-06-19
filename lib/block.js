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

internals.Block.CreateGenesis = function () {
    /*
     *
     * 8a40bfaa73256b60764c1bf40675a99083efb075 (G)
     * e6716f9544a56c530d868e4bfbacb172315bdead (J)
     * 1e12515ce3e0f817a4ddef9ca55788a1d66bd2df (V)
     * 1a26338f0d905e295fccb71fa9ea849ffa12aaf4 (A)
     *
     * hash = 69a7356a245f9dc5b865475ada5ee4e89b18f93c06503a9db3b3630e88e9fb4e
     */

    /*
  var genesis =  new Block();

  genesis.header.parentHash = Buffer(256);
  genesis.header.sha3UncleList = rlp.encode(null);
  genesis.header.coinbase = Buffer(160);
  //genesis.header.stateRoot ;
  genesis.header.sha3transactionList = rlp.encode(null);
  genesis.header.difficulty = 1 << 22;
  genesis.header.timestamp = 0;
  genesis.header.extraData = [];

  var hash = new SHA3.SHA3Hash(256);
  hash.update(new Buffer([42]));
  genesis.header.nonce = hash.digest();

  var startAmount = (bignum(1)).shiftLeft(200);
  */

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
