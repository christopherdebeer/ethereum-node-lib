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

internals.Transaction = module.exports = function (data) {
    this.raw = data;
    if (data) {
        this.parse(data);
    }
};

//parses a transactions
internals.Transaction.prototype.parse = function (data) {
    var fields = ['nonce', 'value', 'gasPrice', 'gasLimit', , 'to', 'v', 'r', 's'];

    if (data[5] !== 0) {
        this.type = "message";
        fields[4] = 'data';
    } else {
        this.type = "contract";
        fields[4] = 'init';
    }

    fields.forEach(function (field, i) {
        Object.defineProperty(internals.Transaction.prototype, field, {
            get: function () {
                return this.raw[i];
            },
            set: function (v) {
                this.raw[i] = v;
            }
        });
    })
};

internals.Transaction.prototype.serialize = function () {
    return this.raw;
};

internals.Transaction.prototype.hash = function () {};
