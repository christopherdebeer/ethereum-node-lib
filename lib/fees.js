var internals = {};
internals.values = exports.fees = {
    "STEP": 1,
    "STOP": 0,
    "SUICIDE": 0,
    "SHA3": 20,
    "SLOAD": 20,
    "SSTORE": 100,
    "BALANCE": 20,
    "CREATE": 100,
    "CALL": 20,
    "MEMORY": 1,
    "TXDATA": 5,
    "TRANSACTION": 500
};

internals.getFee = exports.getFee = function(opcode) {
    var fee = internals.values[opcode];    
    if(!fee){
        fee = 1;
    }
    return fee;
};
