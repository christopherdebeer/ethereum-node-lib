/*
 * This implements the logic for the Peers
 */

var internals = {};

exports.logic = function (peer) {
    //send hello right away
    peer.sendHello(function () {

        //if the peer doesn't responsed within the alloted time; disconnect it
        internals.timeout = setTimeout(function () {
            console.warn('networking| peer timedout');

            //Bad protocol?
            peer.sendDisconnect(0x02);
        }, peer.network.options.timeout);
    });

    peer.on("message", function (payload, data) {
        //No other messages may be sent until a Hello is received
        if (payload[0][0] !== 0x00 && payload[0][0] !== undefined) {
            if (!peer._state.hello) {
                //Bad protocol
                peer.sendDisconnect(0x02);
            }
        }
    });

    peer.on("message.hello", function (hello) {
        clearTimeout(internals.timeout);
        //wait 2 seconds and get peers from this peer
        //we should only get one hello message
        this._state.hello = true;
        this.id = hello.nodeId;
        this.port = hello.port;
        this.ip = hello.ip;
        setTimeout(peer.sendGetPeers.bind(peer), 200);
    });

    peer.on("message.ping", function () {
        peer.sendPong();
    });

    peer.on("message.getPeers", function () {
        if (peer.network.options.peerDiscovery) {
            peer.sendPeers();
        }
    });

    peer.on("message.disconnect", function () {
        peer.socket.end();
    });

    peer.on("message.getTransactions", function () {
        this.sendTransactions();
    });
};
