import { DenoWorker } from './DenoWorker';
import { Server } from 'ws';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
jest.mock('ws');
jest.mock('child_process');

const serverMock: jest.Mock<Server> = <any>Server;
const spawnMock: jest.Mock = <any>spawn;

describe('DenoWorker', () => {
    let worker: DenoWorker;

    beforeEach(() => {
        worker = new DenoWorker();
    });

    afterEach(() => {
        serverMock.mockReset();
        spawnMock.mockReset();
    });

    describe('init', () => {
        it('should try spawning a deno runtime with the given port number', async () => {
            const address = jest.fn(() => ({
                address: '0.0.0.0',
                family: 'IPv4',
                port: 8888,
            }));
            serverMock.mockReturnValue(<any>{
                address,
                on: () => {},
            });

            worker.init();

            expect(Server).toBeCalledTimes(1);
            expect(address).toBeCalledTimes(1);

            expect(spawn).toBeCalledTimes(1);
            expect(spawn).toBeCalledWith('deno', [
                'run',
                '--allow-net=http://127.0.0.1:8888',
                expect.any(String),
                '8888',
            ]);
        });

        it('should wait for an init message from a client', async () => {
            const address = jest.fn(() => ({
                address: '0.0.0.0',
                family: 'IPv4',
                port: 8888,
            }));
            const emitter = new EventEmitter();
            (<any>emitter).address = address;
            serverMock.mockReturnValue(emitter as any);

            let finished = false;
            worker.init().then(() => (finished = true));

            const socket = new EventEmitter();
            emitter.emit('connection', socket);

            socket.emit(
                'message',
                JSON.stringify({
                    type: 'init',
                })
            );

            expect(finished).toBe(true);
        });
    });

    describe('scripts', () => {
        it('should be able to run the given script', () => {});
    });
});
