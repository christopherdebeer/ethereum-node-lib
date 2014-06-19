var SHA3 = require("sha3"),
    assert = require("assert"),
    rlp = require("rlp"),
    fees = require("../fees.js"),
    opcodes = require("./opcodes.js"),
    utils = require("../utils.js");

var internals = {};

internals.VM = module.exports = function () {

};

//run a contract
//tx, code, contractAccount, memory, cb
internals.VM.prototype.run = function (tx, saveAccount, cb) {
    if (arguments.length == 2) {
        cb = saveAccount;
    }
    assert(typeof (this.saveAccount) === "function", "saveAccount must be a function");

    var self = this;
    var returnValue = [];
    var stopped = false;
    var storage = {};
    //programm counter
    var pc = 0;
    //the raw op code
    var op;
    // the opcode add an memonic
    var opcode;
    //how much gas we have left
    var gasLeft = utils.bufferToInt(tx.gasLimit);
    //memory
    var memory = [];
    //the number of btyes stored in memory
    var bytesInMem = 0;
    //The stack of ops
    var stack = [];
    //the code being exicuted
    var code;

    function runCode() {

        while (!stopped && pc < code.length) {
            op = code[pc];
            opcode = opcodes[op];
            //get fee, decrment gas left
            var fee = fees.getFee(opcode);
            gasLeft -= fee;
            //do we still have gas?
            if (gasLeft < 0) break;

            switch (opcode) {
            case "STOP":
                stopped = true;
                break;
            case "ADD":
                break;
            case "MUL":
                break;
            case "SUB":
                break;
            case "DIV":
                break;
            case "SDIV":
                break;
            case "MOD":
                break;
            case "SMOD":
                break;
            case "EXP":
                break;
            case "NEG":
                break;
            case "LT":
                break;
            case "GT":
                break;
            case "SLT":
                break;
            case "SGT":
                break;
            case "EQ":
                break;
            case "NOT":
                break;

                //0x10 range - bit ops
            case "AND":
                break;
            case "OR":
                break;
            case "XOR":
                break;
            case "BYTE":
                break;

                //0x20 range - crypto
            case "SHA3":
                break;

                //0x30 range - closure state
            case "ADDRESS":
                break;
            case "BALANCE":
                break;
            case "ORIGIN":
                break;
            case "CALLER":
                break;
            case "CALLVALUE":
                break;
            case "CALLDATALOAD":
                break;
            case "CALLDATASIZE":
                break;
            case "CALLDATACOPY":
                break;
            case "CODESIZE":
                break;
            case "CODECOPY":
                var memLocation = utils.bufferToInt(stack.pop());
                var codeLocation = utils.bufferToInt(stack.pop());
                var codeLength = utils.bufferToInt(stack.pop());
                for (var i = 0; i < codeLength; i++) {
                    if (memory[memLocation + i] === undefined) {
                        if (bytesInMem % 32 === 0) {
                            gasLeft--;
                            if (gasLeft < 0) break;
                        }
                        bytesInMem++;
                    }
                    memory[memLocation + i] = code[codeLocation + i];
                }
                break;
            case "GASPRICE":
                break;
                //"0x40" range - block operations
            case "PREVHASH":
                break;
            case "COINBASE":
                break;
            case "TIMESTAMP":
                break;
            case "NUMBER":
                break;
            case "DIFFICULTY":
                break;
            case "GASLIMIT":
                break;

                //0x50 range - "storage" and execution
            case "POP":
                break;
            case "DUP":
                stack.push(stack[stack.length - 1]);
                break;
            case "SWAP":
                break;
            case "MLOAD":
                break;
            case "MSTORE":
                break;
            case "MSTORE8":
                break;
            case "SLOAD":
                break;
            case "SSTORE":
                //memory.store(stack.pop(), stack.pop());
                var key = internals.arrayTo256(stack.pop());
                var val = internals.arrayTo256(stack.pop());
                key = key.toString("hex");
                //one day replace with harmony's Hash
                if (!storage[key]) {
                    //creating a new value
                    gasLeft -= fee;
                    if (gasLeft < 0) break;

                    val = rlp.encode(val);
                } else if (val === 0) {
                    //deleting a value
                    gasLeft += fee;
                } else {
                    //replacing a value
                    val = rlp.encode(val);
                }
                storage[key] = val;
                break;
            case "JUMP":
                break;
            case "JUMPI":
                break;
            case "PC":
                break;
            case "MSIZE":
                break;
            case "GAS":
                break;

                //0x60, range
            case "PUSH1":
            case "PUSH2":
            case "PUSH3":
            case "PUSH4":
            case "PUSH5":
            case "PUSH6":
            case "PUSH7":
            case "PUSH8":
            case "PUSH9":
            case "PUSH10":
            case "PUSH11":
            case "PUSH12":
            case "PUSH13":
            case "PUSH14":
            case "PUSH15":
            case "PUSH16":
            case "PUSH17":
            case "PUSH18":
            case "PUSH19":
            case "PUSH20":
            case "PUSH21":
            case "PUSH22":
            case "PUSH23":
            case "PUSH24":
            case "PUSH25":
            case "PUSH26":
            case "PUSH27":
            case "PUSH28":
            case "PUSH29":
            case "PUSH30":
            case "PUSH31":
            case "PUSH32":
                var numToPush = op - 0x5f;
                stack.push(code.slice(pc + 1, pc + 1 + numToPush));
                pc += numToPush;
                break;
                //"0xf0" range - closures
            case "CREATE":
                break;
            case "CALL":
                break;
            case "RETURN":
                var memStart = utils.bufferToInt(stack.pop());
                var memLength = utils.bufferToInt(stack.pop());
                for (var i = 0; i < memLength; i++) {
                    returnValue[i] = memory[memStart + i];
                }
                stopped = true;
                break;
                //"0x70", range - other
            case "LOG": // XXX Unofficia:
                break;
            case "SUICIDE":
                break;

            }
            pc++;
        }
        var gasUsed = utils.bufferToInt(tx.gasLimit) - gasLeft;
        self.saveAccount({
            storage: storage
        }, function () {
            if (cb) cb(new Buffer(returnValue), gasUsed, {
                storage: storage
            });
        });
    }

    // txAccount = tx.getFromAddress
    // tx.validate(txAccount);
    // txAccount.addTx(tx);

    gasLeft -= tx.getBaseFee();
    if (tx.type === "contract") {
        code = tx.data;
        runCode();
    } else {
        assert(typeof (this.loadContract) === "function", "loadContract must be defined and be function");
        //todo: check account
        this.loadAccount(tx.to, function (account) {
            self.code = account.code;
            self.memory = account.memory;
            runCode();
        });
    }
};

internals.VM.prototype.onStep = function (fn) {

};

internals.VM.prototype.onDebug = function (fn) {

};

//generates an address for a new contract
internals.VM.generateAddress = function (account, tx) {
    var hash = new SHA3.SHA3Hash(256);
    hash.update(rlp.encode([tx.address, account.nonce - 1]));
    return hash.digest("hex").slice(24);
};

internals.arrayTo256 = function (array) {
    var buf256 = new Buffer(32);
    buf256.fill(0);

    for (var i = 0; i < array.length; i++) {
        buf256[i] = array[i];
    }

    return buf256;
};
