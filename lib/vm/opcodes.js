module.exports = {
    // 0x0 range - arithmetic ops
    0x00: "STOP",
    0x01: "ADD",
    0x02: "MUL",
    0x03: "SUB",
    0x04: "DIV",
    0x05: "SDIV",
    0x06: "MOD",
    0x07: "SMOD",
    0x08: "EXP",
    0x09: "NEG",
    0x0a: "LT",
    0x0b: "GT",
    0x0c: "SLT",
    0x0d: "SGT",
    0x0e: "EQ",
    0x0f: "NOT",

    //0x10 range - bit ops
    0x10: "AND",
    0x11: "OR",
    0x12: "XOR",
    0x13: "BYTE",

    //0x20 range - crypto
    0x20: "SHA3",

    //0x30 range - closure state
    0x30: "ADDRESS",
    0x31: "BALANCE",
    0x32: "ORIGIN",
    0x33: "CALLER",
    0x34: "CALLVALUE",
    0x35: "CALLDATALOAD",
    0x36: "CALLDATASIZE",
    0x37: "CALLDATACOPY",
    0x38: "CODESIZE",
    0x39: "CODECOPY",
    0x3a: "GASPRICE",

    //"0x40" range - block operations
    0x40: "PREVHASH",
    0x41: "COINBASE",
    0x42: "TIMESTAMP",
    0x43: "NUMBER",
    0x44: "DIFFICULTY",
    0x45: "GASLIMIT",

    //0x50 range - "storage" and execution
    0x50: "POP",
    0x51: "DUP",
    0x52: "SWAP",
    0x53: "MLOAD",
    0x54: "MSTORE",
    0x55: "MSTORE8",
    0x56: "SLOAD",
    0x57: "SSTORE",
    0x58: "JUMP",
    0x59: "JUMPI",
    0x5a: "PC",
    0x5b: "MSIZE",
    0x5c: "GAS",

    //0x60, range
    0x60: "PUSH1",
    0x61: "PUSH2",
    0x62: "PUSH3",
    0x63: "PUSH4",
    0x64: "PUSH5",
    0x65: "PUSH6",
    0x66: "PUSH7",
    0x67: "PUSH8",
    0x68: "PUSH9",
    0x69: "PUSH10",
    0x6a: "PUSH11",
    0x6b: "PUSH12",
    0x6c: "PUSH13",
    0x6d: "PUSH14",
    0x6e: "PUSH15",
    0x6f: "PUSH16",
    0x70: "PUSH17",
    0x71: "PUSH18",
    0x72: "PUSH19",
    0x73: "PUSH20",
    0x74: "PUSH21",
    0x75: "PUSH22",
    0x76: "PUSH23",
    0x77: "PUSH24",
    0x78: "PUSH25",
    0x79: "PUSH26",
    0x7a: "PUSH27",
    0x7b: "PUSH28",
    0x7c: "PUSH29",
    0x7d: "PUSH30",
    0x7e: "PUSH31",
    0x7f: "PUSH32",

    //"0xf0" range - closures
    0xf0: "CREATE",
    0xf1: "CALL",
    0xf2: "RETURN",

    //"0x70", range - other
    0xfe: "LOG", // XXX Unofficial
    0xff: "SUICIDE"
};
