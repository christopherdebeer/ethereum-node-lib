var utils = require("./utils.js"),
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
        "nonce",
        {
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

internals.Transaction.prototype.hash = function () {};

internals.Transaction.prototype.validate = function () {};

internals.Transaction.prototype.loadAccount = function () {};

//The amount of gas paid for the data in this tx
internals.Transaction.prototype.dataFee = function (){
    return this.raw[5].length * fees.getFee("TXDATA");    
};
