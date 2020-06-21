const WebSocket = require('ws');
const EventEmitter = require('events');
const WebSocketClient = require('./WebSocketClient');

module.exports = class WebSocketServer extends EventEmitter {
    constructor() {
        super();

        this._clients = new Map();

        this._wss = new WebSocket.Server({
            noServer: true,
            clientTracking: false,
        });

        this._wss.on('connection', (ws, req, auth) => {
            const wsc = new WebSocketClient(ws, req, auth, this);

            this._clients.set(wsc.uuid, wsc);
            ws.on('close', () => this._clients.delete(wsc.uuid));

            wsc.on('message', (message) => this.emit('message', message));
        });
    }

    upgrade(req, socket, head, auth) {
        this._wss.handleUpgrade(req, socket, head, (ws) => {
            this._wss.emit('connection', ws, req, auth);
        });
    }

    find(uuid) {
        return this._clients.get(uuid);
    }

    list() {
        return Array.from(this._clients).map(entry => entry[1]);
    }
};
