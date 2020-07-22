self.onmessage = (event) => {
    if (event.data.type === 'port') {
        let port = event.data.port;
        port.onmessage = (e) => {
            if (e.data === 'ping') {
                port.postMessage('pong');
            }
        };
    } else if (event.data.type === 'request_port') {
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => {
            if (e.data === 'ping') {
                channel.port1.postMessage('pong');
            }
        };

        self.postMessage(
            {
                type: 'port',
                port: channel.port2,
            },
            [channel.port2]
        );
    }
};
