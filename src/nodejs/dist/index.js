'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var ws = require('ws');
var child_process = require('child_process');

class DenoWorker {
    init() {
        return new Promise((resolve, reject) => {
            const server = new ws.Server();
            server.on('connection', socket => {
                socket.on('message', (data) => {
                    if (typeof data !== 'string') {
                        return;
                    }
                    const message = JSON.parse(data);
                    if (message.type === 'init') {
                        resolve();
                    }
                });
            });
            const addr = server.address();
            if (typeof addr === 'object') {
                child_process.spawn('deno', [
                    'run',
                    '--allow-net=http://127.0.0.1:' + addr.port,
                    '../deno/index.ts',
                    addr.port.toString()
                ]);
            }
            else {
                return reject(new Error('Needs the address to be an object.'));
            }
        });
    }
    _onConnection(socket) {
    }
}

exports.DenoWorker = DenoWorker;
