var utils = require("./utils"),
    rlp   = require("rlp");

var internals = {};

internals.Account = module.exports = function (data) {
    var self = this,
        fields = ["nonce", "balance", "stateRoot", "codeHash"];

    if (!data) {
        data = [new Buffer([0]), new Buffer([0]), new Buffer([0]), utils.emptyHash()];
    }
    this.raw = data;

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
                        v = utils.intToBuffer(v);
                    }
                }
                this.raw[i] = v;
            }
        });
    });
};

internals.Account.prototype.serialize = function(){
    return rlp.encode(this.raw);
};

// internals.Account.prototype.loadMemCode = function(cb){};
// internals.Account.prototype.getCode = function(cb){};
// internals.Account.prototype.getMemory = function(cb){};
