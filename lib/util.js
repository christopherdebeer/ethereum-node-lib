var zero256 = exports.zero256 = function () {
    return new Buffer(32).fill(0);
};

/**
 * Constant: 160 bit filled with 0s
 * @return {Buffer} 160 bits of zero hash
 */
var zero160 = exports.zero160 = function () {
    return new Buffer(20).fill(0);
};
