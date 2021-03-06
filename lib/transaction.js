var SHA3 = require('sha3'),
    assert = require('assert'),
    BigInteger = require('bigi'),
    bignum = require('bignum'),
    ecdsa = require('ecdsa'),
    rlp = require('rlp'),
    utils = require('./utils.js'),
    fees = require('./fees.js'),
    ecurve = require('ecurve');

var internals = {},
    ecparams = ecurve.getECParams('secp256k1');

internals.Transaction = module.exports = function (data) {
    this.raw = [
        new Buffer([0]), //nonce
        new Buffer([0]), //gasPrice
        new Buffer([0]), //gasLimit
        utils.zero160(), //to
        new Buffer([0]), //value
        new Buffer([0]), //data
        new Buffer([0x1c]), //i
        utils.zero256(),
        utils.zero256()
    ];

    if (!data) data = this.raw;
    this.parse(data);
};

//parses a transactions
internals.Transaction.prototype.parse = function (data) {
    var self = this,
        fields = [
            'nonce',
            'gasPrice',
            'gasLimit', {
                name: 'to',
                length: 20
            },
            'value',
            'data',
            'v',
            'r',
            's'
        ];
    this.raw = [];

    //make sure all the items are buffers
    data.forEach(function (d, i) {
        self.raw[i] = typeof d === 'string' ? new Buffer(d, 'hex') : d;
    });

    if (data.length === 6) {
        this.raw = data.concat(null, null, null);
    }

    utils.validate(fields, this.raw);
    utils.defineProperties(this, fields);
    this.type = utils.bufferToInt(data[3]) !== 0 ? 'message' : 'contract';

    Object.defineProperty(this, 'to', {
        set: function (v) {
            if (!Buffer.isBuffer(v)) {
                if (typeof v === 'string') {
                    v = new Buffer(v, 'hex');
                } else {
                    v = utils.intToBuffer(v);
                }
            }

            assert(v.length === 20, 'The field `to` must have byte length of 20');
            this.raw[3] = v;
            this.type = utils.bufferToInt(this.raw[3]) !== 0 ? 'message' : 'contract';
        }
    });

};

internals.Transaction.prototype.serialize = function () {
    return rlp.encode(this.raw);
};

/**
 * Computes a sha3-256 hash of the tx
 * @method hash
 * @param {Boolean} [true] signature - whether or not to inculde the signature
 */
internals.Transaction.prototype.hash = function (signature) {
    var toHash,
        hash = new SHA3.SHA3Hash(256);

    if (typeof signature === 'undefined') {
        signature = true;
    }

    if (signature) {
        toHash = this.raw;
    } else {
        toHash = this.raw.slice(0, -3);
    }

    //create hash
    hash.update(rlp.encode(toHash));
    return new Buffer(hash.digest('hex'), 'hex');
};

internals.Transaction.prototype.getSenderAddress = function () {
    var pubKey = this.getSenderPublicKey();
    return utils.pubToAddress(pubKey);
};

//get's the senders public key
internals.Transaction.prototype.getSenderPublicKey = function () {
    var msgHash = this.hash(false),
        sig = this.getSignature(),
        e = BigInteger.fromBuffer(msgHash),
        recoveredKey = false;

    try {
        var key = ecdsa.recoverPubKey(e, sig, sig.v);
        recoveredKey = key.getEncoded(false);
    } catch (e) {
        recoveredKey = false;
    }

    return recoveredKey;
};

internals.Transaction.prototype.verifySignature = function () {
    var msgHash = this.hash(false),
        pubKey = this.getSenderPublicKey(),
        sig = this.getSignature();

    if (pubKey) {
        return ecdsa.verify(msgHash, sig, pubKey);
    } else {
        return false;
    }
};

//returns the tx's signature
internals.Transaction.prototype.getSignature = function () {
    return {
        r: BigInteger.fromBuffer(this.r),
        s: BigInteger.fromBuffer(this.s),
        v: utils.bufferToInt(this.v) - 27
    };
};

internals.Transaction.prototype.sign = function (privateKey) {
    var msgHash = this.hash(false),
        e = BigInteger.fromBuffer(msgHash),
        signature = ecdsa.sign(msgHash, privateKey);

    this.r = signature.r.toBuffer();
    this.s = signature.s.toBuffer();

    var curvePt = ecparams.g.multiply(BigInteger.fromBuffer(privateKey));
    this.v = ecdsa.calcPubKeyRecoveryParam(e, signature, curvePt) + 27;
};

/**
 * The amount of gas paid for the data in this tx
 * @method dataFee
 * @return {Integer}
 */
internals.Transaction.prototype.getDataFee = function () {
    var data = this.raw[5];
    if (data.length === 1 && data[0] === 0) {
        return bignum(0);
    } else {
        return bignum(this.raw[5].length).mul(fees.getFee('TXDATA'));
    }
};

/**
 * the base amount of gas it takes to be a valid tx
 * @method baseFee
 * @return {Interger}
 */
internals.Transaction.prototype.getBaseFee = function () {
    return this.getDataFee().add(fees.getFee('TRANSACTION'));
};

/**
 * 
 * @method baseFee
 * @return {Interger}
 */
internals.Transaction.prototype.getBaseCost = function () {
    return this.getBaseFee()
        .mul(bignum.fromBuffer(this.gasPrice))
        .add(bignum.fromBuffer(this.value));
};

internals.Transaction.prototype.getUpfrontCost = function () {
    return bignum.fromBuffer(this.gasLimit)
        .mul(bignum.fromBuffer(this.gasPrice))
        .add(bignum.fromBuffer(this.value));
};

/**
 * validates the signature and checks to see if it has enough gas
 * @method validate
 * @return {Boolean}
 */
internals.Transaction.prototype.validate = function () {
    return this.verifySignature() && (this.getBaseFee() <= utils.bufferToInt(this.gasLimit));
};
