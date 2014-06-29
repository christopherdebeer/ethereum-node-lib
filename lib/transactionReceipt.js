var Transaction = require('./transaction.js'),
    rlp = require('rlp');

var internals = {};

internals.TransactionReceipt = module.exports = function (data) {
    this.transaction = new Transaction(data[0]);

    if (!Buffer.isBuffer(data[1])) {
        data[1] = new Buffer(data[1], 'hex');
    }

    if (!Buffer.isBuffer(data[2])) {
        data[2] = new Buffer(data[2], 'hex');
    }

    this.state = data[1];
    this.gasUsed = data[2];
};

internals.TransactionReceipt.prototype.serialize = function () {
    return rlp.encode([
        this.transaction.raw,
        this.state,
        this.gasUsed
    ]);
};
