var SHA3 = require("sha3"),
    BigInteger = require("bigi"),
    ecdsa = require("ecdsa"),
    rlp = require("rlp"),
    utils = require("./utils.js"),
    fees = require("./fees.js");

var internals = {};

/*
 * TODO validation:
(1) The transaction signature is valid;
(2) the transaction nonce is valid (equivalent to the
        sender account’s current nonce);
(3) the gas limit is no smaller than the intrinsic gas,
    g 0 , used by the transaction;
(4) the sender account balance contains at least the
cost, v 0 , required in up-front payment;
*/

internals.Transaction = module.exports = function (data, trie) {
    this.raw = data;
    this.trie = trie;
    if (data) {
        this.parse(data);
    }
};

//parses a transactions
internals.Transaction.prototype.parse = function (data) {
    var self = this,
        fields = [
            "nonce", {
                name: "gasPrice",
                type: "int"
            }, {
                name: "gasLimit",
                type: "int"
            },
            "to",
            "value",
            null,
            "v",
            "r",
            "s"
        ];

    if (utils.bufferToInt(data[3]) !== 0) {
        this.type = "message";
        fields[5] = "data";
    } else {
        this.type = "contract";
        fields[5] = "init";
    }

    fields.forEach(function (field, i) {
        if (!field.name) {
            field = {
                name: field
            };
        }

        Object.defineProperty(self, field.name, {
            get: function () {
                if (field.type === "int") {
                    return utils.bufferToInt(this.raw[i]);
                } else {
                    return this.raw[i];
                }
            },
            set: function (v) {
                if (field.type === "int") {
                    this.raw[i] = utils.intToBuffer(v);
                } else {
                    this.raw[i] = v;
                }
            }
        });
    });
};

internals.Transaction.prototype.serialize = function () {
    return this.raw;
};

/**
 * Computes a sha3-256 hash of the tx
 * @method hash
 * $param {Boolean} [true] signature - where or not to inculde the signature
 */
internals.Transaction.prototype.hash = function (signature) {
    if (typeof signature == "undefined") {
        signature = true;
    }

    var toHash;
    if (signature) {
        toHash = this.raw;
    } else {
        toHash = this.raw.slice(0, -3);
    }

    //create hash
    var hash = new SHA3.SHA3Hash(256);
    hash.update(toHash);
    return new Buffer(hash.digest("hex"), "hex");
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
        recoveredKey = ecdsa.recoverPubKey(e, sig, sig.v);

    return recoveredKey.getEncoded(false); //gets public key
};


internals.Transaction.prototype.validateSignature = function () {
    var msgHash = this.hash(false),
        pubKey = this.getSenderPublicKey(),
        sig = this.getSignature();

    return ecdsa.verify(msgHash, sig, pubKey);
};

//returns the tx's signature
internals.Transaction.prototype.getSignature = function () {
    return {
        r: BigInteger.fromBuffer(this.r),
        s: BigInteger.fromHex(this.s),
        v: this.v - 27
    };
};

/**
 * The amount of gas paid for the data in this tx
 * @method dataFee
 * @return {Integer}
 */
internals.Transaction.prototype.dataFee = function () {
    return this.raw[5].length * fees.getFee("TXDATA");
};

/**
 * the base amount it take to be a valid tx
 * @method baseFee
 * @return {Interger}
 */
internals.Transaction.prototype.baseFee = function () {
    return this.dataFee() + fees.getFee("TRANSACTION");
};
