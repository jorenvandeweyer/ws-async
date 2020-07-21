const { v1: uuidv1 } = require('uuid');

const TYPES = {
    'INITIALIZE': 'initialize',
    'DEFAULT': 'default',
    'ASYNC': 'async',
    'RESPONSE': {
        'RESOLVED': 'response.resolved',
        'REJECTED': 'response.rejected',
        'TIMEDOUT': 'response.timedout',
    },
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
    outgoing: true,
    timeout: 15,
    content: 'Hello world',
};

module.exports = class WebSocketMessage {
    constructor(wsc, options) {
        options = {
            uuid: uuidv1(),
            to: wsc._server ? wsc.uuid : 'server',
            from: wsc._server ? 'server' : wsc.uuid,
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

        if (this._outgoing) {
            this._wsc._messages.set(this.uuid, this);
        }

        this._timeout = setTimeout(() => {
            this._state = WebSocketMessage.STATES.TIMEDOUT;
            this.reject();
        }, options.timeout * 1000);
    }

    handle() {
        if (!this.state.isCreated) {
            console.debug('cannot handle message, already handled');
            return;
        }

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

        if (this.type === TYPES.INITIALIZE) {
            if (this._wsc._server) {
                this._reject({
                    content: 'Server clients can not be initialized',
                });
                return;
            }
            this._wsc.uuid = this.content;
            this.resolve();
        } else if (this.type === TYPES.RESPONSE.RESOLVED) {
            const wsm = this._wsc.findMessage(this.uuid);
            if (!wsm) return;
            wsm.resolve(this.resolve());
        } else if (this.type === TYPES.RESPONSE.REJECTED) {
            const wsm = this._wsc.findMessage(this.uuid);
            if (!wsm) return;
            wsm.reject(this.reject());
        } else if (this.type === TYPES.RESPONSE.TIMEDOUT) {
            const wsm = this._wsc.findMessage(this.uuid);
            if (!wsm) return;
            wsm._state = STATES.TIMEDOUT;
            wsm.reject(this.reject());
        } else if (this.type === TYPES.PING) {
            this._wsc._ping = Date.now() - this.content;
            this.resolve();

            this._wsc.send({
                type: TYPES.PONG,
                content: Date.now(),
            });
        } else if (this.type === TYPES.PONG) {
            this._wsc._ping = Date.now() - this.content;
            this.resolve();
        } else {
            this._wsc.emit('message', this);
        }
    }

    resolve(content) {
        if (!this.state.isPending) {
            return console.log('already resolved');
        }

        this._state = STATES.RESOLVED;

        content = (content === undefined) ? this : content;

        if (content instanceof WebSocketMessage) {
            content = content.content;
        }

        if (this._resolve) this._resolve(content);

        if (this.type === TYPES.ASYNC && !this._outgoing) {
            const wsm = new WebSocketMessage(this._wsc, {
                uuid: this.uuid,
                type: TYPES.RESPONSE.RESOLVED,
                from: this._wsc.uuid || this.to,
                to: this.from,
                outgoing: true,
                content,
            });

            wsm.handle();
        }

        this.destroy();

        return content;
    }

    reject(content) {
        if (!this.state.isPending && !this.state.isTimedout) {
            return console.log('already resolved/rejected');
        }
        console.log('rejected', this.uuid);

        if (this.state.isPending) {
            this._state = STATES.REJECTED;
        }

        content = (content === undefined) ? this : content;

        if (content instanceof WebSocketMessage) {
            content = content.content;
        }

        if (this._reject) this._reject(content);

        if (this.type === TYPES.ASYNC && !this._outgoing) {
            const type = this.state.isPending
                ? TYPES.RESPONSE.REJECTED
                : TYPES.RESPONSE.TIMEDOUT;

            const wsm = new WebSocketMessage(this._wsc, {
                uuid: this.uuid,
                type,
                from: this._wsc.uuid || this.to,
                to: this.from,
                outgoing: true,
                content,
            });

            wsm.handle();
        }

        this.destroy();

        return content;
    }

    destroy() {
        clearTimeout(this._timeout);

        if (this.state.isDestroyed) {
            return console.log('already destroyed');
        }

        if (this.state.isPending) {
            console.log('still pending');
            return this.reject();
        }

        this._state = STATES.DESTROYED;

        this._wsc._messages.delete(this.uuid);
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
