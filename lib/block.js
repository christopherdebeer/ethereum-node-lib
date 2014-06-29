var rlp = require('rlp'),
    SHA3 = require('sha3'),
    Trie = require('merkle-patricia-tree'),
    async = require('async'),
    utils = require('./utils.js'),
    bignum = require('bignum'),
    Transaction = require('./transaction.js'),
    TR = require('../lib/transactionReceipt.js');

var internals = {};

internals.Block = module.exports = function (data) {
    this.header = {};
    this.transactionReceipts = [];
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

    this.txTrie = new Trie();

    this.header = new internals.BlockHeader(data[0]);
    var rawTransactions = data[1],
        rawUncleHeaders = data[2];

    //parse uncle headers
    for (var i = 0; i < rawUncleHeaders.length; i++) {
        this.uncleHeaders.push(new internals.BlockHeaders(rawUncleHeaders[i]));
    }

    //parse transactions
    for (var i = 0; i < rawTransactions.length; i++) {
        var tr = new TR(rawTransactions[i]);
        this.transactionReceipts.push(tr);
    }
};

/*
 *Produces a hash the RLP of the block
 *@method hash
 */
internals.Block.prototype.hash = function () {
    var hash = new SHA3.SHA3Hash(256);
    hash.update(this.serialize());
    return new Buffer(hash.digest('hex'), 'hex');
};

internals.Block.prototype.serialize = function () {
    var raw = [this.header.raw, [],
        []
    ];

    this.transactionReceipts.forEach(function (tr) {
        raw[1].push([tr.transaction.raw, tr.state, tr.gasUsed]);
    });

    this.uncleHeaders.forEach(function (uncle) {
        raw[2].push(uncle.raw);
    });

    return rlp.encode(raw);
};

internals.Block.prototype.genTxTrie = function (cb) {
    var i = 0,
        self = this;

    async.eachSeries(this.transactionReceipts, function (tr, done) {
        self.txTrie.put(rlp.encode(0), tr.serialize(), done);
        i++;
    }, function () {
        if(cb) cb();
    });
};

//TODO:
internals.Block.prototype.validateTransactionsTrie = function () {
    var txT = this.header.transactionsTrie.toString('hex');
    if (this.transactionReceipts.length === 0) {
        return txT === '00';
    } else {
        return txT === this.txTrie.root.toString('hex');
    }
};

internals.Block.prototype.validateTransactions = function () {
    var validTxs = true;
    this.transactionReceipts.forEach(function (tr) {
        validTxs &= tr.transaction.verifySignature();
    });
    return validTxs;
};

internals.Block.prototype.validate = function (parentBlock, ppBlock) {
    var validUncles = true;

    this.uncleHeaders.forEach(function (uncle) {
        validUncles &= uncle.validate(ppBlock);
    });
    return validUncles &&
        this.header.validate(parentBlock) &&
        this.validateTransactionsTrie() &&
        this.validateTransactions();
};

/*
 * Block Header
 */
internals.BlockHeader = function (data) {
    var self = this,
        fields = [{
                name: 'parentHash',
                length: 32
            }, {
                name: 'uncleHash',
                length: 32
            }, {
                name: 'coinbase',
                length: 20
            }, {
                name: 'stateRoot',
                length: 32
            },
            'transactionsTrie',
            'difficulty',
            'number',
            'minGasPrice',
            'gasLimit',
            'gasUsed',
            'timestamp',
            'extraData', {
                name: 'nonce',
                length: 32
            }
        ];

    this.raw = [];
    if (!data || data.length === 0) {
        var hash = new SHA3.SHA3Hash(256);
        hash.update(new Buffer([42]));
        this.raw = [
            utils.zero256(), //parent
            utils.emptyRlpHash(), //uncles
            utils.zero160(), //coinbase
            utils.zero256(), //state root
            new Buffer([0]), //trasacntionsTrie
            utils.intToBuffer(Math.pow(2, 22)), //difficulty
            new Buffer([0]), //number
            new Buffer([0]), //minGasPrice
            utils.intToBuffer(1000000), //gasLimit
            new Buffer([0]),
            new Buffer([0]),
            new Buffer([0]),
            new Buffer(hash.digest('hex'), 'hex')
        ];
    }

    //make sure all the items are buffers
    data.forEach(function (d, i) {
        self.raw[i] = typeof d === 'string' ? new Buffer(d, 'hex') : d;
    });

    utils.validate(fields, this.raw);
    utils.defineProperties(this, fields);
};

internals.BlockHeader.prototype.validatePOW = function () {
    var raw = this.raw.slice(0, -1),
        hash = new SHA3.SHA3Hash(256),
        hash2 = new SHA3.SHA3Hash(256);

    hash.update(rlp.encode(raw));
    var i = new Buffer(hash.digest('hex'), 'hex');
    var a = Buffer.concat([i, this.raw[12]]);
    hash2.update(a);

    var pow = bignum(hash2.digest('hex'), 16);
    return pow.lt(bignum(2).pow(256).div(bignum.fromBuffer(this.difficulty)));
};

internals.BlockHeader.prototype.canonicalDifficulty = function (parentBlock) {
    var blockTs = utils.bufferToInt(this.timestamp),
        parentTs = utils.bufferToInt(parentBlock.header.timestamp),
        parentDif = utils.bufferToInt(parentBlock.header.difficulty),
        dif;

    if (blockTs < parentTs + 42) {
        dif = parentDif + Math.floor(parentDif / 1024);
    } else {
        dif = parentDif - Math.floor(parentDif / 1024);
    }
    return dif;
};

//check the block for the canical difficulty
internals.BlockHeader.prototype.validateDifficulty = function (parentBlock) {
    var dif = this.canonicalDifficulty(parentBlock);
    return dif === utils.bufferToInt(this.difficulty);
};

internals.BlockHeader.prototype.canonicalGaslimit = function (parentBlock) {
    var pGasLim = utils.bufferToInt(parentBlock.header.gasLimit),
        pGasUsed = utils.bufferToInt(parentBlock.header.gasUsed),
        gasLimit = Math.floor((1023 * pGasLim + Math.floor(6 / 5 * pGasUsed)) / 1024);

    if (gasLimit < 10000) {
        gasLimit = 10000;
    }
    return gasLimit;
};

internals.BlockHeader.prototype.validateGasLimit = function (parentBlock) {
    var gasLimit = this.canonicalGaslimit(parentBlock);
    return utils.bufferToInt(this.gasLimit) === gasLimit;
};

internals.BlockHeader.prototype.validate = function (parentBlock) {
    return this.validateDifficulty(parentBlock) &&
        this.validateGasLimit(parentBlock) &&
        this.validatePOW() &&
        (utils.bufferToInt(this.timestamp) >= utils.bufferToInt(parentBlock.header.timestamp)) &&
        (this.extraData.length < 1024);
};
