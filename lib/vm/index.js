var SHA3 = require('sha3'),
    async = require('async'),
    assert = require('assert'),
    bignum = require('bignum'),
    rlp = require('rlp'),
    Account = require('../account'),
    fees = require('../fees.js'),
    opcodes = require('./opcodes.js'),
    utils = require('../utils.js');

var internals = {};

internals.VM = module.exports = function (params) {
    this.trie = params.trie;
    this.block = params.block;
};


/**
 * Process a transaction. Run the vm. Transfers eth. checks balaces
 * @method processTx
 * @param {Transaciton} tx - a transaction
 * @param {Block} block needed to process the transaction
 * @param {Function} cb - the callback
 */
internals.VM.prototype.runTx = function (tx, cb) {
    var address = new Buffer(tx.getSenderAddress(), 'hex'),
        self = this,
        fromAccount,
        toAccount,
        code = false,
        data,
        gasUsed = bignum(0);

    async.auto({
            fromAccount: function (cb2) {
                //gets the senders account
                self.trie.get(address, function (err, account) {
                    fromAccount = new Account(account);
                    cb2(err, fromAccount);
                });
            },
            toAccount: function (cb2) {
                //get receivers account
                if (tx.type === 'contract') {
                    toAccount = new Account();
                    cb2(null, toAccount);
                } else {
                    self.trie.get(tx.to, function (err, account) {
                        toAccount = new Account(account);
                        cb2(err, toAccount);
                    });
                }
            },
            code: ['toAccount',
                function (cb2) {
                    //TODO: wtf are we actully doing?
                    if (toAccount.isContract()) {
                        self.trie.get(toAccount.codeHash, function (err, c) {
                            code = c;
                            data = tx.data;
                            cb2(err);
                        });
                    } else {
                        if (tx.type === 'contract') {
                            code = tx.data;
                        }
                        cb2();
                    }
                }
            ],
            processAccounts: ['toAccount', 'fromAccount',
                function (cb2) {

                    var fromBalance = bignum.fromBuffer(fromAccount.balance),
                        fromNonce = bignum.fromBuffer(fromAccount.nonce);

                    //does the sender have enought money and the correct nonce?
                    if (fromBalance.ge(tx.getUpfrontCost()) && fromNonce.eq(bignum.fromBuffer(tx.nonce))) {

                        //add the amount sent to the `to` account
                        toAccount.balance = bignum
                            .fromBuffer(toAccount.balance)
                            .add(bignum.fromBuffer(tx.value))
                            .toBuffer();

                        //subcract the the amount sent and the TX fee
                        fromAccount.balance = fromBalance
                            .sub(tx.getBaseCost())
                            .toBuffer();

                        gasUsed = tx.getBaseFee();

                        cb2();
                    } else {
                        cb2('sender doesn\' have correct nonce or balance');
                    }
                }
            ],
            vm: ['processAccounts',
                function (cb2) {
                    // //run VM
                    if (code) {
                        var gasLeft = bignum.fromBuffer(tx.gasLimit).sub(gasUsed);
                        self.runCode(code, data, gasLeft, toAccount.stateRoot, function (err, results) {
                            fromAccount.balance = bignum.fromBuffer(fromAccount.balance)
                                .sub(results.gasUsed.mul(bignum.fromBuffer(tx.gasPrice)));

                            toAccount.stateRoot = results.storage;
                            gasUsed = gasUsed.add(results.gasUsed);
                            cb2(err, results);
                        });
                    } else {
                        cb2();
                    }
                }
            ],
            saveSender: ['saveReceiver',
                function (cb2) {
                    //incement the senders nonce
                    fromAccount.nonce = bignum.fromBuffer(fromAccount.nonce).add(1).toBuffer();
                    self.trie.put(address, fromAccount.serialize(), cb2);
                }
            ],
            saveReceiver: ['vm',
                function (cb2, results) {
                    //save accounts
                    var address;
                    if (tx.type === 'contract') {
                        address = internals.VM.generateAddress(tx, fromAccount);
                    } else {
                        address = tx.to;
                    }
                    self.trie.put(new Buffer(address, 'hex'), toAccount.serialize(), cb2);
                }
            ],
            saveCode: ['vm',
                function (cb2, results) {
                    if (tx.type === 'contract' && results.vm.returnValue.toString() !== '0') {
                        var code = results.vm.returnValue;
                        var hash = new SHA3.SHA3Hash(256);
                        hash.update(code);
                        toAccount.codeHash = hash.digest('hex');
                        self.trie.db.put(toAccount.codeHash, {
                                enoding: 'binary'
                            },
                            code, cb2);
                    } else {
                        cb2();
                    }
                }
            ]
        },
        function (err, results) {
            //reformat results
            results.gasUsed = gasUsed;
            results.fromAccount = fromAccount;
            results.toAccount = toAccount;
            results.amountSpent = gasUsed.mul(bignum.fromBuffer(tx.gasPrice));
            if (results.vm) results.returnValue = results.vm.returnValue;
            cb(err, results);
        });
};

internals.VM.prototype.runCode = function runCode(code, data, gasLimit, storageRoot, cb) {
    var self = this;
    var returnValue = [];
    var stopped = false;
    //programm counter
    var pc = -1;
    //the raw op code
    var op;
    // the opcode add an memonic
    var opcode;
    //how much gas we have left
    var gasLeft = bignum(gasLimit);
    //memory
    var memory = [];
    //the number of btyes stored in memory
    var bytesInMem = 0;
    //The stack of ops
    var stack = [];
    //the code being exicuted
    var exception;

    var storage = [];

    var stateRoot = this.trie.root;
    if (storageRoot.length === 1) {
        this.trie.root = null;
    } else {
        this.trie.root = storageRoot;
    }

    async.whilst(function () {
        pc++;
        return !stopped && pc < code.length;
    }, function (done) {
        op = code[pc];
        opcode = opcodes[op];
        //get fee, decrment gas left
        var fee = fees.getFee(opcode);
        gasLeft = gasLeft.sub(fee);
        //do we still have gas?
        if (gasLeft.lt(0)) {
            done('out of gas');
        } else {
            switch (opcode) {
            case 'STOP':
                stopped = true;
                done();
                break;
            case 'ADD':
                done();
                break;
            case 'MUL':
                done();
                break;
            case 'SUB':
                done();
                break;
            case 'DIV':
                done();
                break;
            case 'SDIV':
                done();
                break;
            case 'MOD':
                done();
                break;
            case 'SMOD':
                done();
                break;
            case 'EXP':
                done();
                break;
            case 'NEG':
                done();
                break;
            case 'LT':
                done();
                break;
            case 'GT':
                done();
                break;
            case 'SLT':
                done();
                break;
            case 'SGT':
                done();
                break;
            case 'EQ':
                done();
                break;
            case 'NOT':
                done();
                break;

                //0x10 range - bit ops
            case 'AND':
                done();
                break;
            case 'OR':
                done();
                break;
            case 'XOR':
                done();
                break;
            case 'BYTE':
                done();
                break;

                //0x20 range - crypto
            case 'SHA3':
                done();
                break;

                //0x30 range - closure state
            case 'ADDRESS':
                done();
                break;
            case 'BALANCE':
                done();
                break;
            case 'ORIGIN':
                done();
                break;
            case 'CALLER':
                done();
                break;
            case 'CALLVALUE':
                done();
                break;
            case 'CALLDATALOAD':
                done();
                break;
            case 'CALLDATASIZE':
                done();
                break;
            case 'CALLDATACOPY':
                done();
                break;
            case 'CODESIZE':
                done();
                break;
            case 'CODECOPY':
                var memLocation = utils.bufferToInt(stack.pop());
                var codeLocation = utils.bufferToInt(stack.pop());
                var codeLength = utils.bufferToInt(stack.pop());
                for (var i = 0; i < codeLength; i++) {
                    if (memory[memLocation + i] === undefined) {
                        if (bytesInMem % 32 === 0) {
                            gasLeft = gasLeft.sub(1);
                            if (gasLeft.lt(0)) break;
                        }
                        bytesInMem++;
                    }
                    memory[memLocation + i] = code[codeLocation + i];
                }
                done();
                break;
            case 'GASPRICE':
                done();
                break;
                //'0x40' range - block operations
            case 'PREVHASH':
                done();
                break;
            case 'COINBASE':
                done();
                break;
            case 'TIMESTAMP':
                done();
                break;
            case 'NUMBER':
                done();
                break;
            case 'DIFFICULTY':
                done();
                break;
            case 'GASLIMIT':
                done();
                break;

                //0x50 range - 'storage' and execution
            case 'POP':
                done();
                break;
            case 'DUP':
                stack.push(stack[stack.length - 1]);
                done();
                break;
            case 'SWAP':
                done();
                break;
            case 'MLOAD':
                done();
                break;
            case 'MSTORE':
                done();
                break;
            case 'MSTORE8':
                done();
                break;
            case 'SLOAD':
                done();
                break;
            case 'SSTORE':
                //memory.store(stack.pop(), stack.pop());
                var key = internals.arrayTo256(stack.pop());
                var val = stack.pop();

                self.trie.get(key, function (err, found) {
                    if (!found) {
                        //creating a new value
                        gasLeft = gasLeft.sub(fee);
                        if (gasLeft.lt(0)) {
                            done(err);
                            return;
                        }

                        val = rlp.encode(val);
                    } else if (val.toString('hex') === utils.zero256().toString('hex')) {
                        //deleting a value
                        gasLeft = gasLeft.add(fee);
                        val = '';
                    } else {
                        //replacing a value
                        val = rlp.encode(val);
                    }

                    self.trie.put(key, val, done);
                });

                break;
            case 'JUMP':
                done();
                break;
            case 'JUMPI':
                done();
                break;
            case 'PC':
                done();
                break;
            case 'MSIZE':
                done();
                break;
            case 'GAS':
                done();
                break;

                //0x60, range
            case 'PUSH1':
            case 'PUSH2':
            case 'PUSH3':
            case 'PUSH4':
            case 'PUSH5':
            case 'PUSH6':
            case 'PUSH7':
            case 'PUSH8':
            case 'PUSH9':
            case 'PUSH10':
            case 'PUSH11':
            case 'PUSH12':
            case 'PUSH13':
            case 'PUSH14':
            case 'PUSH15':
            case 'PUSH16':
            case 'PUSH17':
            case 'PUSH18':
            case 'PUSH19':
            case 'PUSH20':
            case 'PUSH21':
            case 'PUSH22':
            case 'PUSH23':
            case 'PUSH24':
            case 'PUSH25':
            case 'PUSH26':
            case 'PUSH27':
            case 'PUSH28':
            case 'PUSH29':
            case 'PUSH30':
            case 'PUSH31':
            case 'PUSH32':
                var numToPush = op - 0x5f;
                stack.push(code.slice(pc + 1, pc + 1 + numToPush));
                pc += numToPush;
                done();
                break;
                //'0xf0' range - closures
            case 'CREATE':
                done();
                break;
            case 'CALL':
                done();
                break;
            case 'RETURN':
                var memStart = utils.bufferToInt(stack.pop());
                var memLength = utils.bufferToInt(stack.pop());
                for (var i = 0; i < memLength; i++) {
                    returnValue[i] = memory[memStart + i];
                }
                stopped = true;
                done();
                break;
                //'0x70', range - other
            case 'SUICIDE':
                done();
                break;
            }
        }

    }, function (err) {
        storageRoot = self.trie.root;
        self.trie.root = stateRoot;
        var gasUsed = bignum(gasLimit).sub(gasLeft);
        cb(null, {
            gasUsed: gasUsed,
            storage: storageRoot,
            exception: err,
            returnValue: new Buffer(returnValue)
        });
    });
};

internals.VM.prototype.onStep = function (fn) {

};

internals.VM.prototype.onDebug = function (fn) {

};

//generates an address for a new contract
internals.VM.generateAddress = function (tx, account) {
    var hash = new SHA3.SHA3Hash(256);
    hash.update(rlp.encode([new Buffer(tx.getSenderAddress(), 'hex'), account.nonce]));
    return hash.digest('hex').slice(24);
};

internals.arrayTo256 = function (array) {
    var buf256 = new Buffer(32);

    if (array.length !== 32) {
        buf256.fill(0);
        for (var i = 0; i < array.length; i++) {
            buf256[32 - array.length + i] = array[i];
        }
    } else {
        buf256 = array;
    }

    return buf256;
};
