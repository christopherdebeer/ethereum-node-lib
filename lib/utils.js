var SHA3 = require("sha3"),
    assert = require("assert"),
    ECKey = require("eckey");

var internals = {};

exports.zero256 = function () {
    var buf = new Buffer(32);
    buf.fill(0);
    return buf;
};

/**
 * Constant: 160 bit filled with 0s
 * @return {Buffer} 160 bits of zero hash
 */
exports.zero160 = function () {
    var buf = new Buffer(20);
    buf.fill(0);
    return buf;
};

exports.emptyHash = function () {
    var hash = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
    return new Buffer(hash, "hex");
};

exports.emptyRlpHash = function () {
    var hash = "1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
    return new Buffer(hash, "hex");
}

exports.intToHex = function (i) {
    assert(i % 1 === 0, "number is not a interger");
    assert(i >= 0, "number must be positive");
    var hex = i.toString(16);
    if (hex.length % 2) {
        hex = "0" + hex;
    }
    return hex;
};

internals.intToBuffer = exports.intToBuffer = function (i) {
    var hex = exports.intToHex(i);
    return new Buffer(hex, "hex");
};

exports.bufferToInt = function (buf) {
    return parseInt(buf.toString("hex"), 16);
};

/**
 * converts a private key to an address
 * @method privToAddress
 * @param {Buffer} privateKey
 */
exports.privToAddress = function (privateKey) {
    var key = new ECKey(privateKey, false),
        pubKey = key.publicKey;
    return exports.pubToAddress(pubKey);
};

exports.pubToAddress = function (pubKey) {
    var hash = new SHA3.SHA3Hash(256);
    hash.update(pubKey.slice(1));
    return hash.digest("hex").slice(-40);
};

exports.defineProperties = function (self, fields) {

    fields.forEach(function (field, i) {
        if (!field.name) {
            field = {
                name: field
            };
        }

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
                        v = internals.intToBuffer(v);
                    }
                }

                if (field.length) {
                    assert(field.length === v.length, "The field " + field.name + "must have byte length of " + field.length);
                }

                this.raw[i] = v;
            }
        });
    });
};

exports.validate = function(fields, data){
    var i = 0;
    fields.forEach(function(f){
        if(f.name && f.length){
            assert(data[i].length === f.length, "invalid data for field: " + f.name + " needs length:" + f.length + "got length: " + data[i].length);
        }
        i++;
    });
};
