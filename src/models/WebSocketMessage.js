const { v1: uuidv1 } = require('uuid');

const TYPES = {
    'INITIALIZE': 'initialize',
    'DEFAULT': 'default',
    'ASYNC': 'async',
    'RESPONSE': 'response',
    'BROADCAST': 'broadcast',
    'PING': 'ping',
    'PONG': 'pong',
};

const STATES = {
    'CREATED': 'created',
    'PENDING': 'pending',
    'RESOLVED': 'resolved',
    'REJECTED': 'rejected',
    'TIMEDOUT': 'timedout',
    'DESTROYED': 'destroyed',
};

const DEFAULT_MESSAGE = {
    type: TYPES.DEFAULT,
    from: 'server',
    outgoing: true,
    timeout: 15,
    content: 'Hello world',
};

module.exports = class WebSocketMessage {
    constructor(wsc, options) {
        options = {
            uuid: uuidv1(),
            to: wsc.uuid,
            ...DEFAULT_MESSAGE,
            ...options

        };

        this._state = WebSocketMessage.STATES.CREATED;
        this._resolve = null;
        this._reject = null;

        this._outgoing = options.outgoing;
        this._wsc = wsc;

        this._raw = null;

        this._message = {
            uuid: options.uuid,
            type: options.type,
            from: options.from,
            to: options.to,
            content: options.content,
        };

        this._wsc._messages.set(this.uuid, this);

        this._timeout = setTimeout(() => {
            this._state = WebSocketMessage.STATES.TIMEDOUT;
            this.destroy();
        }, options.timeout * 1000);
    }

    handle() {
        if (!this.state.isCreated) {
            console.debug('cannot handle message, already handled');
            return;
        }

        console.debug('handling message');

        this._state = WebSocketMessage.STATES.PENDING;

        if (this._outgoing) {
            this._wsc._socket.send(JSON.stringify(this.raw));

            if (this.type === TYPES.ASYNC) {
                return new Promise((resolve, reject) => {
                    this._resolve = resolve;
                    this._reject = reject;
                });
            } else {
                return this.resolve();
            }
        }

        this._wsc._pinged = Date.now();

        if (this.type === TYPES.RESPONSE) {
            const wsm = this._wsc.findMessage(this.uuid);

            if (this.isTimedout) {
                wsm.destroy(this.destroy());
            } else {
                wsm.resolve(this.resolve());
            }
            return this.resolve();
        } else if (this.type === TYPES.PING) {
            this._wsc._ping = Date.now() - this.content;
            this.resolve();

            // this._wsc.send({
            //     type: TYPES.PONG,
            //     content: Date.now(),
            // });
        } else if (this.type === TYPES.PONG) {
            this._wsc._ping = Date.now() - this.content;
            this.resolve();
        } else if (this.type === TYPES.INITIALIZE) {
            if (this._wsc._server) {
                this._reject({
                    content: 'Server clients can not be initialized',
                });
                return;
            }
            this._wsc.uuid = this.content;
            console.debug('set uuid on client');
            this.resolve();
        } else {
            this._wsc.emit('message', this);
        }
    }

    respond(content) {
        if (!this._outgoing || this.type !== TYPES.ASYNC) {
            console.log('respond only works on async incomming messages');
            return;
        }

        const wsm = new WebSocketMessage(this._wsc, {
            uuid: this.uuid,
            type: TYPES.RESPONSE,
            from: this._wsc.uuid || this.to,
            to: this.from,
            outgoing: true,
            content,
        });

        this.resolve();

        return wsm.handle();
    }

    resolve(message) {
        if (!this.state.isPending) {
            console.debug('cannot resolve message, not pending anymore');
            return;
        }

        console.debug('resolving message', this.uuid);

        this._state = WebSocketMessage.STATES.RESOLVED;

        message = message || this.raw;

        if (this._resolve) this._resolve(message);

        //destorying should be handled better?
        this.destroy();

        return message;
    }

    reject(message) {
        if (!this.state.isPending) {
            console.debug('cannot reject message, not pending anymore');
            return;
        }

        console.debug('rejecting message', this.uuid);

        this._state = STATES.REJECTED;

        message = message || this.raw;

        if (this._reject) this._reject(message);

        this.destroy();

        return message;
    }

    destroy(message) {
        clearTimeout(this._timeout);

        console.debug('destroying message', this.uuid);

        message = message || this.raw;

        if (this.state.isDestroyed) {
            console.debug('cannot destroy message, already destroyed');
            return;
        } else if (this.state.isResolved || this.state.isRejected) {
            console.debug('destroying message peacefully');
        } else if (this.state.isTimedout) {
            console.debug('destroying message because of timeout');
            if (this._reject) this._reject(message);
        } else if (this.state.isPending) {
            console.debug('early destroy??');
            this._state = STATES.DESTROYED;
            if (this._reject) this._reject(message);
        }

        this._state = STATES.DESTROYED;

        this._wsc._messages.delete(this.uuid);

        return message;
    }

    get uuid() {
        return this._message.uuid;
    }

    get from() {
        return this._message.from;
    }

    get to() {
        return this._message.to;
    }

    get type() {
        return this._message.type;
    }

    get content() {
        return this._message.content;
    }

    get raw() {
        return {
            ...this._message,
            _state: this._state,
        };
    }

    get state() {
        return {
            isPending: this._state === STATES.PENDING,
            isCreated: this._state === STATES.CREATED,
            isRejected: this._state === STATES.REJECTED,
            isResolved: this._state === STATES.RESOLVED,
            isTimedout: this._state === STATES.TIMEDOUT,
            isDestroyed: this._state === STATES.DESTROYED,
        };
    }

    static get TYPES() {
        return TYPES;
    }

    static get STATES() {
        return STATES;
    }
};
