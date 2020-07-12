const WebSocketMessage = require('../models/WebSocketMessage');

module.exports = (raw, wsc) => {
    const parsed = JSON.parse(raw);

    const message = new WebSocketMessage(wsc, {
        uuid: parsed.uuid,
        to: parsed.to,
        type: parsed.type,
        content: parsed.content,
    });

    message._raw = raw;
    message._outgoing = false;

    // prevent spoofing
    message._message.from = wsc.uuid;

    return message;
};
