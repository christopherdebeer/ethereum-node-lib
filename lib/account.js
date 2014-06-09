var internals = {},
    Utils = require('./utils');

internals.Account = module.exports = function (data, trie) {
    this.raw = data;
    this.trie = trie;
    var fields = ['nonce', 'balance', 'stateRoot', 'codeHash'];
    this.parseBlock(data);
};

internals.Account.prototype.loadMemCode = function(cb){};
internals.Account.prototype.getCode = function(cb){};
internals.Account.prototype.getMemory = function(cb){};
