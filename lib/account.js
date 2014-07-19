var utils = require('./utils'),
    rlp   = require('rlp');

var internals = {};

internals.Account = module.exports = function (data) {
    //if buffer, then maybe its rlp encoded
    if(Buffer.isBuffer(data)){
        data = rlp.decode(data);
    }

    var self = this,
        fields = ['nonce', 'balance', 'stateRoot', 'codeHash'];

    this.raw = [];

    if (!data) {
        data = [new Buffer([0]), new Buffer([0]), new Buffer([0]), utils.emptyHash()];
    }

    //make sure all the items are buffers
    data.forEach(function (d, i) {
        self.raw[i] = typeof d === 'string' ? new Buffer(d, 'hex') : d;
    });

    utils.validate(fields, this.raw);
    utils.defineProperties(this, fields);
};

internals.Account.prototype.serialize = function(){
    return rlp.encode(this.raw);
};

internals.Account.prototype.isContract = function(){
    return (utils.emptyHash().toString('hex') !== this.codeHash.toString('hex'));
};


