import WebSocket, { Server } from 'ws';
import { spawn } from 'child_process';

export class DenoWorker {
    init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const server = new Server();
            server.on('connection', (socket) => {
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
                spawn('deno', [
                    'run',
                    '--allow-net=http://127.0.0.1:' + addr.port,
                    '../deno/index.ts',
                    addr.port.toString(),
                ]);
            } else {
                return reject(new Error('Needs the address to be an object.'));
            }
        });
    }

    private _onConnection(socket: WebSocket) {}
}
