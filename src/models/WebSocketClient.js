const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const WebSocketMessage = require('./WebSocketMessage');
const WebSocketMessageTransformer = require('../transformers/WebSocketMessageTransformer');
const { TYPES } = require('./WebSocketMessage');

module.exports = class WebSocketClient extends EventEmitter {
    constructor (socket, req, auth, server) {
        super();

        this.uuid = null;

        this._messages = new Map();

        //todo initialize websocket if null
        this._socket = null;
        this._req = req;
        this._auth = auth;
        this._server = server;
        this._pinged = 0;
        this._ping = null;

        if (socket) {
            this.attachSocket(socket);
        }

        if (this._server && this._socket) {
            this.uuid = uuidv4();

            this.send({
                type: WebSocketMessage.TYPES.INITIALIZE,
                content: this.uuid,
            });
        }


        const delay = 120;

        this._pingInterval = setInterval(() => {
            if (this._pinged === false) {
                console.log('did not pong :( destroying');
                this.destroy();
                return;
            }

            if (this._pinged + delay*1000 > Date.now()) {
                console.log('skipping ping');
                return;
            }

            this._pinged = false;

            this.send({
                type: TYPES.PING,
                content: Date.now(),
            });
        }, pingInterval(delay, 5));
    }

    attachSocket(socket) {
        if (this._socket) {
            this._socket.terminate();
            this._socket = null;
        }

        this._socket = socket;

        this._socket.on('open', e => this.emit('open', e));
        this._socket.on('close', e => this.emit('close', e));
        this._socket.on('error', e => this.emit('error', e));

        this._socket.on('message', (message) => {
            const wsm = WebSocketMessageTransformer(message, this);
            wsm.handle();
        });
    }

    async send(options) {
        const wsm = new WebSocketMessage(this, {
            ...options,
        });

        return await wsm.handle();
    }

    destroy() {
        clearInterval(this._pingInterval);

        this._messages.forEach(message => {
            message.destroy(false);
        });

        return this._socket.terminate();
    }

    findMessage(uuid) {
        return this._messages.get(uuid);
    }

    get data() {
        return {
            uuid: this.uuid,
        };
    }
};

function pingInterval(delay=30, offset=5) {
    let rand = Math.random();

    rand -= 0.5;
    rand /= 50;
    rand *= offset; //max percent
    rand += 1;

    return rand * delay * 1000;
}
