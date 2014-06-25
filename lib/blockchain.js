var async = require("async"),
    _ = require("underscore"),
    bignum = require("bignum"),
    rlp = require("rlp"),
    Sha3 = require("sha3"),
    Block = require("./block.js"),
    utils = require("./utils.js"),
    internals = {};

internals.Blockchain = module.exports = function (blockDB, detailsDB) {
    this.blockDB = blockDB;
    this.detailsDB = detailsDB;
};

internals.Blockchain.prototype.load = function (callback) {
    var self = this;

    this.detailsDB.get("head", function (err, headHash) {
        if (headHash) {
            self.blockDB.get(new Buffer(headHash, "hex"), {
                encoding: "binary"
            }, function (err, head) {
                if (head) {
                    self.head = new Block(rlp.decode(head));
                }
                callback();
            });
        } else {
            callback();
        }
    });
};

/*
 * Adds a block to the blockchain
 * @method addBlock
 * @param {object} block -the block to be added to the block chain
 * @param {function} cb - a callback function
 * TODO: validate states
 */
internals.Blockchain.prototype.addBlock = function (block, cb) {
    var self = this,
        blockHash = block.hash();

    this.getBlockInfo(block.header.parentHash, function (err, parentDetails) {
        if (parentDetails || block.header.parentHash.toString("hex") === utils.zero256().toString("hex")) {
            async.parallel([
                //store the block
                function (callback) {
                    self.blockDB.put(blockHash, block.serialize(), {
                        encoding: "binary"
                    }, callback);
                },
                //update and store the details
                function (callback) {
                    var totallDifficulty = utils.bufferToInt(block.header.difficulty);

                    block.uncleHeaders.forEach(function (uncle) {
                        totallDifficulty += utils.bufferToInt(uncle.difficulty);
                    });

                    if (parentDetails) {
                        totallDifficulty += parentDetails.totallDifficulty;
                        parentDetails.children.push([blockHash, totallDifficulty]);
                        //sort so the canical child always comes first.
                        parentDetails.children = _.sortBy(parentDetails.children, function (child) {
                            return child[1];
                        });
                    }

                    var ops = [{
                        type: "put",
                        key: "head",
                        value: blockHash.toString("hex")
                    }, {
                        type: "put",
                        key: blockHash.toString("hex"),
                        value: {
                            parent: block.header.parentHash,
                            children: []
                        }
                    }];

                    if (parentDetails) {
                        ops.push({
                            type: "put",
                            key: block.header.parentHash.toString("hex"),
                            value: parentDetails
                        });
                    }

                    self.detailsDB.batch(ops, callback);
                }
            ], cb);
        } else {
            cb(err);
        }
    });
};

/*
 *Gets a block by its hash
 * @method getBlock
 * @param {String} hash - the sha256 hash of the rlp encoding of the block
 * @param {Function} cb - the callback function
 */
internals.Blockchain.prototype.getBlock = function (hash, cb) {
    this.blockDB.get(hash, function (err, value) {
        //run callback
        if (typeof (cb) == "function") {
            var block = null;
            if (!err) {
                block = new Block(value);
                block._inBlockChain = true;
            }
            cb(err, block);
        }
    });
};

/*
 *Gets a block by its hash
 * @method getBlock
 * @param {String} hash - the sha256 hash of the rlp encoding of the block
 * @param {Function} cb - the callback function
 */
internals.Blockchain.prototype.getBlockInfo = function (hash, cb) {
    this.detailsDB.get(hash, function (err, value) {
        //run callback
        if (typeof (cb) == "function") {
            var block = null;
            if (!err) {
                block = new Block(value);
                block._inBlockChain = true;
            }
            cb(err, block);
        }
    });
};

/*
 * Gets a segment of the blockchain starting at one of the parnet hashes
 * @method getBlockChain
 * @param {Array} parentHashes - an array of parents hashes to start from
 * @param {Interger} count the number of blocks to return
 * @param {Function} cb - the callback which is passed any errors and the blocks
 */
internals.Blockchain.prototype.getBlockChain = function (parentHashes, count, cb) {
    var i = 0,
        foundParent = false;

    if (typeof (cb) !== "function") {
        cb = function () {};
    }

    //find the parent
    async.whilst(function () {
        return !foundParent && i < parentHashes.length;
    }, function () {
        db.get(parentHashes[i], function (err, value) {
            i++;
            if (!err) {
                foundParent = value;
            }
        });
    }, function (err) {
        if (foundParent && foundParent.child && !err) {
            var blocksFound = [];
            //find the children
            async.whilst(function () {
                return blocksFound.length < count && foundParent && foundParent.child;
            }, function () {
                db.get(foundParent.child, function (err, value) {
                    if (!err) {
                        blocksFound.push(new Block(value.data));
                        foundParent = value;
                    }
                });
            }, function (err) {
                cb(err, blocksFound);
            });
        } else {
            cb(err, null);
        }
    });
};

internals.Blockchain.prototype.hash = function () {
    var hash = new Sha3.SHA3Hash(256);
    hash.update(this.serialize());
    //no way to get a buffer directly from the hash :(
    var key = hash.digest("hex");
    return new Buffer(key, "hex");
};

internals.Blockchain.prototype.serialize = function () {
    return rlp.encode(this.raw);
};
