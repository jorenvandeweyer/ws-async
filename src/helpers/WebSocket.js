/*eslint no-ternary: "off"*/

const WS = typeof WebSocket === 'undefined'
    ? require('ws')
    : WebSocket;

module.exports = class extends WS {
    constructor(...args) {
        super(...args);
    }

    terminate() {
        if (typeof super.terminate !== 'undefined') {
            super.terminate();
        } else if (typeof super.close !== 'undefined') {
            this.close();
        } else {
            console.error('"destory" not supported');
        }
    }

    on(event, listener) {
        if (typeof super.on !== 'undefined') {
            return super.on(event, listener);
        } else if (typeof super.addEventListener !== 'undefined') {
            if (event === 'message') {
                return super.addEventListener(event, (ev) => listener(ev.data));
            }
            return super.addEventListener(event, listener);
        } else {
            console.error('"on" not supported');
        }
    }
};

