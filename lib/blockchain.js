var async = require('async'),
    _ = require('underscore'),
    bignum = require('bignum'),
    rlp = require('rlp'),
    Sha3 = require('sha3'),
    Block = require('./block.js'),
    utils = require('./utils.js'),
    internals = {};

internals.Blockchain = module.exports = function (blockDB, detailsDB) {
    this.blockDB = blockDB;
    this.detailsDB = detailsDB;
};

internals.Blockchain.prototype.init = function (callback) {
    var self = this;

    this.detailsDB.get('head', function (err, headHash) {
        if (headHash) {
            self.blockDB.get(new Buffer(headHash, 'hex'), {
                encoding: 'binary'
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

    if (block.constructor !== Block) {
        block = new Block(block);
    }

    var self = this,
        blockHash = block.hash();

    //look up the parent info
    this.getBlockInfo(block.header.parentHash.toString('hex'), function (err, parentDetails) {
        if (parentDetails || block.header.parentHash.toString('hex') === utils.zero256().toString('hex')) {
            async.parallel([
                //store the block
                function (callback) {
                    self.blockDB.put(blockHash, block.serialize(), {
                        encoding: 'binary'
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
                        parentDetails.children.push({
                            hash: blockHash.toString('hex'),
                            totallDifficulty: totallDifficulty
                        });
                        //sort so the canical child always comes first.
                        parentDetails.children = _.sortBy(parentDetails.children, function (child) {
                            return child.hash;
                        });
                    }

                    var ops = [{
                        type: 'put',
                        key: blockHash.toString('hex'),
                        valueEncoding: 'json',
                        value: {
                            parent: block.header.parentHash.toString('hex'),
                            children: []
                        }
                    }];

                    if (parentDetails) {
                        ops.push({
                            type: 'put',
                            key: block.header.parentHash.toString('hex'),
                            valueEncoding: 'json',
                            value: parentDetails
                        });
                    }

                    block.totallDifficulty = totallDifficulty;

                    if (!self.head || block.totallDifficulty > self.head.totalDifficulty) {
                        ops.push({
                            type: 'put',
                            key: 'head',
                            valueEncoding: 'json',
                            value: blockHash.toString('hex')
                        });
                        self.head = block;
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
        if (typeof (cb) == 'function') {
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
    if (Buffer.isBuffer(hash)) {
        hash = hash.toString('hex');
    }

    this.detailsDB.get(hash, {
        valueEncoding: 'json'
    }, cb);
};

/*
 * Gets a segment of the blockchain starting at one of the parnet hashes only
 * returns the hashes of the blocks
 * @method getBlockChain
 * @param {Array} parentHashes - an array of parents hashes to start from
 * @param {Interger} count the number of blocks to return
 * @param {Function} cb - the callback which is passed any errors and the blocks
 */
internals.Blockchain.prototype.getBlockHashes = function (parentHashes, count, cb) {
    var i = 0,
        foundParent = false,
        self = this;

    if (!(parentHashes instanceof Array)) {
        parentHashes = [parentHashes];
    }

    parentHashes = parentHashes.map(function (d) {
        return Buffer.isBuffer(d) ? d.toString('hex') : d;
    });

    if (typeof (cb) !== 'function') {
        cb = function () {};
    }

    //find the parent
    async.whilst(function () {
        return !foundParent && i < parentHashes.length;
    }, function (done) {
        self.getBlockInfo(parentHashes[i], function (err, value) {
            i++;
            if (!err) {
                foundParent = value;
            }
            done(err);
        });
    }, function (err) {
        if (foundParent && !err) {
            var hashsFound = [];
            if (count > 0) {
                //find the children
                async.whilst(function () {
                    return hashsFound.length < count && foundParent.children[0];
                }, function (done) {
                    self.getBlockInfo(foundParent.children[0].hash, function (err, value) {
                        if (!err) {
                            hashsFound.push(foundParent.children[0].hash);
                            foundParent = value;
                        }
                        done(err);
                    });
                }, function (err) {
                    cb(err, hashsFound);
                });
            } else if (count < 0) {
                //find the children
                async.whilst(function () {
                    return hashsFound.length < -count && foundParent.parent !== utils.zero256().toString('hex');
                }, function (done) {
                    self.getBlockInfo(foundParent.parent, function (err, value) {
                        if (!err) {
                            hashsFound.push(foundParent.parent);
                            foundParent = value;
                        }
                        done(err);
                    });
                }, function (err) {
                    cb(err, hashsFound);
                });
            } else {
                cb(null, null);
            }
        } else {
            cb(err, null);
        }
    });
};
