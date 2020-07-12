const WebSocketMessage = require('../models/WebSocketMessage');

module.exports = (raw, wsc) => {
    const parsed = JSON.parse(raw);

    const message = new WebSocketMessage(wsc, {
        uuid: parsed.uuid,
        to: parsed.to,
        type: parsed.type,
        content: parsed.content,
        outgoing: false,
    });

    message._raw = raw;

    // prevent spoofing
    message._message.from = wsc.uuid;

    return message;
};
