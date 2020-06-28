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

            wsc.on('message', (message) => this._handle(message));
        });
    }

    _handle(message) {
        if (message.to === 'server') {
            return this.emit('message', message);
        }

        const from = this.find(message.from);
        const to = this.find(message.to);

        const forward = async () => {
            const result = await to.send(message.raw);
            message.resolve(result);
        };

        if (typeof this.handle === 'function') {
            this.handle(message, from, to, forward);
        } else {
            forward();
        }
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
