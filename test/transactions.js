var ECkey = require("eckey"),
    assert = require("assert"),
    rlp = require("rlp"),
    utils = require("../lib/utils.js"),
    Transaction = require("../lib/transaction.js"),
    txFixtures = require("./fixtures/txs.json");

describe("[Transaction]: Basic functions", function () {
    var transactions = [];
    it("should decode transactions", function (done) {
        txFixtures.forEach(function (tx) {
            var t = new Transaction(tx.raw);
            assert(t.nonce.toString("hex") === tx.raw[0]);
            assert(t.gasPrice.toString("hex") === tx.raw[1]);
            assert(t.gasLimit.toString("hex") === tx.raw[2]);
            assert(t.to.toString("hex") === tx.raw[3]);
            assert(t.value.toString("hex") === tx.raw[4]);
            assert(t.v.toString("hex") === tx.raw[6]);
            assert(t.r.toString("hex") === tx.raw[7]);
            assert(t.s.toString("hex") === tx.raw[8]);

            if (tx.type === "contract") {
                assert(t.type === "contract");
                assert(t.init.toString("hex") === tx.raw[5]);
            } else {
                assert(t.type === "message");
                assert(t.data.toString("hex") === tx.raw[5]);
            }
            transactions.push(t);
        });
        done();
    });

    it("should serialize", function (done) {
        transactions.forEach(function (tx, i) {
            assert.deepEqual(tx.serialize(), rlp.encode(tx.raw));
        });
        done();
    });

    it("should correctly calcuate the upfront fee", function (done) {
        transactions.forEach(function (tx, i) {
            assert(tx.getBaseFee() === txFixtures[i].cost);
        });
        done();
    });

    it("should get sender's address", function (done) {
        transactions.forEach(function (tx, i) {
            assert(tx.getSenderAddress().toString("hex") === txFixtures[i].sendersAddress);
        });
        done();
    });

    it("should get sender's public key", function (done) {
        transactions.forEach(function (tx, i) {
            var key = new ECkey(new Buffer(txFixtures[i].privateKey, "hex"), false);
            var publicKey = key.publicKey;
            assert.deepEqual(tx.getSenderPublicKey(), publicKey);
        });
        done();
    });

    it("should verify Signatures", function (done) {
        transactions.forEach(function (tx) {
            assert(tx.verifySignature() === true);
        });
        done();
    });

    it("should  not verify Signatures", function (done) {
        transactions.forEach(function (tx) {
            tx.s = utils.zero256();
            assert(tx.verifySignature() === false);
        });
        done();
    });

    it("should sign tx", function (done) {
        transactions.forEach(function (tx, i) {
            var privKey = new Buffer(txFixtures[i].privateKey, "hex");
            tx.sign(privKey);
        });
        done();
    });

    it("should get sender's address after signing it", function (done) {
        transactions.forEach(function (tx, i) {
            assert(tx.getSenderAddress().toString("hex") === txFixtures[i].sendersAddress);
        });
        done();
    });

    it("should get sender's public key after singing it", function (done) {
        transactions.forEach(function (tx, i) {
            var key = new ECkey(new Buffer(txFixtures[i].privateKey, "hex"), false);
            var publicKey = key.publicKey;
            assert.deepEqual(tx.getSenderPublicKey(), publicKey);
        });
        done();
    });

    it("should verify signing it", function (done) {
        transactions.forEach(function (tx) {
            assert(tx.verifySignature() === true);
        });
        done();
    });
});
