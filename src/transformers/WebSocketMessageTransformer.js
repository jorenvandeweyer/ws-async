const WebSocketMessage = require('../models/WebSocketMessage');

module.exports = (raw, wsc) => {
    const parsed = JSON.parse(raw);

    const message = new WebSocketMessage(wsc);

    message._raw = raw;
    message._outgoing = false;

    // prevent spoofing
    message._message.from = wsc.uuid;

    message._message.uuid = parsed.uuid;
    message._message.to = parsed.to;
    message._message.type = parsed.type;
    message._message.content = parsed.content;

    return message;
};
