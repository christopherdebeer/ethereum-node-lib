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

/**
 * Fetches the meta info about the blockchain from the db. Meta info contains
 * the hash of the head block and the hash of the genisis block
 * @method init
 * @param {Function} callback
 */
internals.Blockchain.prototype.init = function (callback) {
  var self = this;

  this.detailsDB.get('meta', {
      valueEncoding: 'json'
    },
    function (err, meta) {
      if (meta) {
        self.meta = meta;
        self.genesisHash = meta.genesis;
        self.blockDB.get(new Buffer(meta.head, 'hex'), {
          encoding: 'binary'
        }, function (err, head) {
          if (head) {
            self.head = new Block(rlp.decode(head));
          }
          callback(err);
        });
      } else {
        self.meta = {};
        callback();
      }
    });
};

/**
 * Adds a block to the blockchain
 * @method addBlock
 * @param {object} block -the block to be added to the block chain
 * @param {function} cb - a callback function
 */
internals.Blockchain.prototype.addBlock = function (block, cb) {
  if (block.constructor !== Block) {
    block = new Block(block);
  }

  var self = this,
    blockHash = block.hash();

  //look up the parent info
  async.auto({
    parentInfo: function (cb2) {
      self.getBlockInfo(block.header.parentHash.toString('hex'), function (err, pd) {
        if (pd || block.header.parentHash.toString('hex') === utils.zero256().toString('hex')) {
          cb2(null, pd);
        } else {
          cb2('parent hash not found');
        }
      });
    },
    //store the block
    storeBlock: function (cb2) {
      self.blockDB.put(blockHash, block.serialize(), {
        encoding: 'binary'
      }, cb2);
    },
    //update and store the details
    storeParentDetails:['parentInfo', function (cb2, results) {
      //calculate the total difficulty for this block
      var totallDifficulty = utils.bufferToInt(block.header.difficulty),
        parentDetails = results.parentInfo,
        dbOps = [];

      block.uncleHeaders.forEach(function (uncle) {
        totallDifficulty += utils.bufferToInt(uncle.difficulty);
      });
      //add this block as a child to the parent's block details
      if (parentDetails) {
        totallDifficulty += parentDetails.totallDifficulty;
        parentDetails.children.push({
          hash: blockHash.toString('hex'),
          totallDifficulty: totallDifficulty
        });
        //sort so the child with the highest difficulty always comes first.
        parentDetails.children = _.sortBy(parentDetails.children, function (child) {
          return child.totallDifficulty;
        });
        //save
        dbOps.push({
          type: 'put',
          key: block.header.parentHash.toString('hex'),
          valueEncoding: 'json',
          value: parentDetails
        });
      }

      //store the block details
      dbOps.push({
        type: 'put',
        key: blockHash.toString('hex'),
        valueEncoding: 'json',
        value: {
          parent: block.header.parentHash.toString('hex'),
          totallDifficulty: totallDifficulty,
          children: []
        }
      });

      //store the head block if this block has a bigger difficulty
      //than the prevous block
      if (!self.head || totallDifficulty > self.meta.td) {
        self.meta.head = blockHash.toString('hex');
        self.meta.height = utils.bufferToInt(block.header.number);
        self.meta.td = totallDifficulty;

        if (!self.head) {
          self.meta.genesis = blockHash.toString('hex');
        }

        dbOps.push({
          type: 'put',
          key: 'meta',
          valueEncoding: 'json',
          value: self.meta
        });

        self.head = block;
      }
      self.detailsDB.batch(dbOps, cb2);
    }]
  }, cb);
};

/**
 *Gets a block by its hash
 * @method getBlock
 * @param {String} hash - the sha256 hash of the rlp encoding of the block
 * @param {Function} cb - the callback function
 */
internals.Blockchain.prototype.getBlock = function (hash, cb) {

  hash = Buffer.isBuffer(hash) ? hash : new Buffer(hash, 'hex');

  this.blockDB.get(hash, {
    encoding: 'binary'
  }, function (err, value) {
    //run callback
    if (typeof (cb) === 'function') {
      var block = null;
      if (!err) {
        block = new Block(rlp.decode(value));
        block._inBlockChain = true;
      }
      cb(err, block);
    }
  });
};

/**
 * Gets a block by its hash
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

/**
 * Gets a segment of the blockchain given the parent hash and `count `
 * returns the hashes of the blocks
 * @method getBlockChain
 * @param {Array} parentHashes - an array of parents hashes to start from
 * @param {Interger} count the number of blocks to return
 * @param {Function} cb - the callback which is passed any errors and the blocks
 * The resulting block hashes are ordered newest to oldest.
 */
internals.Blockchain.prototype.getBlockHashes = function (parentHash, count, cb) {
  var self = this;

  parentHash = Buffer.isBuffer(parentHash) ? parentHash.toString('hex') : parentHash;

  if (typeof (cb) !== 'function') {
    cb = function () {};
  }

  //find the parent
  self.getBlockInfo(parentHash, function (err, foundParent) {
    if (foundParent && !err) {
      var hashsFound = [];
      if (count > 0) {
        //find the children
        async.whilst(function () {
          return hashsFound.length < count && foundParent.children[0];
        }, function (done) {
          self.getBlockInfo(foundParent.children[0].hash, function (err, value) {
            if (!err) {
              hashsFound.unshift(foundParent.children[0].hash);
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
        //count === 0 
        cb(null, null);
      }
    } else {
      //n initail parent found or err finding parent
      cb(err, null);
    }
  });
};


/**
 * Finds `count` number blocks starting with the child of the first found block
 * @method getBlockChain
 * @param {Array} parentHashes - an array of parent hashs, starting with the newest block hash
 * @param {Interger} count - the number of blocks to return
 * @param {Function} cb
 */
internals.Blockchain.prototype.getBlockChain = function (parentHashes, count, cb) {
  //parentHashes should be ordered newest first
  var self = this,
    foundHashes = false,
    foundBlocks = [];

  parentHashes = _.isArray(parentHashes) ? parentHashes : [parentHashes];

  async.whilst(function () {
      return !foundHashes && (parentHashes.length !== 0);
    }, function (done) {
      //try and find one of the parent hashes
      var ph = parentHashes.shift();
      self.getBlockHashes(ph, count, function (err, hashes) {
        if (hashes) {
          foundHashes = hashes;
        }
        done();
      });
    },
    function (err) {
      if (foundHashes) {
        async.each(foundHashes, function (hash, done) {
          self.getBlock(hash, function (err, block) {
            if (block) {
              foundBlocks.push(block);
              done(err);
            }
          });
        }, function () {
          cb(err, foundBlocks);
        });
      } else {
        cb('no blocks found', null);
      }
    });
};
