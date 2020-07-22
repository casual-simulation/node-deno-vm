import { DenoWorker } from './DenoWorker';
import { readFileSync } from 'fs';
import path from 'path';
import { URL } from 'url';
import { MessageChannel, MessagePort } from './MessageChannel';

console.log = jest.fn();
jest.setTimeout(10000);

describe('DenoWorker', () => {
    let worker: DenoWorker;
    const echoFile = path.resolve(__dirname, './test/echo.js');
    const echoScript = readFileSync(echoFile, { encoding: 'utf-8' });
    const pingFile = path.resolve(__dirname, './test/ping.js');
    const pingScript = readFileSync(pingFile, { encoding: 'utf-8' });

    afterEach(() => {
        if (worker) {
            worker.terminate();
        }
    });

    describe('scripts', () => {
        it('should be able to run the given script', async () => {
            worker = new DenoWorker(echoScript);

            let ret: any;
            let resolve: any;
            let promise = new Promise((res, rej) => {
                resolve = res;
            });
            worker.onmessage = (e) => {
                ret = e.data;
                resolve();
            };

            worker.postMessage({
                type: 'echo',
                message: 'Hello',
            });

            await promise;

            expect(ret).toEqual({
                type: 'echo',
                message: 'Hello',
            });
        });

        it('should be able to import the given script', async () => {
            const file = path.resolve(__dirname, './test/echo.js');

            const url = new URL(`file://${file}`);
            worker = new DenoWorker(url, {
                permissions: {
                    allowRead: [file],
                },
            });

            let ret: any;
            let resolve: any;
            let promise = new Promise((res, rej) => {
                resolve = res;
            });
            worker.onmessage = (e) => {
                ret = e.data;
                resolve();
            };

            worker.postMessage({
                type: 'echo',
                message: 'Hello',
            });

            await promise;

            expect(ret).toEqual({
                type: 'echo',
                message: 'Hello',
            });
        });
    });

    describe('data types', () => {
        let ret: any;
        let resolve: any;
        let promise: Promise<any>;
        beforeEach(() => {
            worker = new DenoWorker(echoScript);
            promise = new Promise((res, rej) => {
                resolve = res;
            });

            worker.onmessage = (e) => {
                ret = e.data;
                resolve();
            };
        });

        it('should be able pass BigInt values', async () => {
            worker.postMessage({
                type: 'echo',
                num: BigInt(9007199254740991),
            });

            await promise;

            expect(ret).toEqual({
                type: 'echo',
                num: BigInt(9007199254740991),
            });
        });

        it('should be able pass Date values', async () => {
            worker.postMessage({
                type: 'echo',
                time: new Date(2020, 7, 21, 7, 54, 32, 412),
            });

            await promise;

            expect(ret).toEqual({
                type: 'echo',
                time: new Date(2020, 7, 21, 7, 54, 32, 412),
            });
        });

        it('should be able pass RegExp values', async () => {
            worker.postMessage({
                type: 'echo',
                regex: new RegExp('^hellosworld$'),
            });

            await promise;

            expect(ret).toEqual({
                type: 'echo',
                regex: new RegExp('^hellosworld$'),
            });
        });

        it('should be able pass Map values', async () => {
            worker.postMessage({
                type: 'echo',
                map: new Map([
                    ['key', 'value'],
                    ['key2', 'value2'],
                ]),
            });

            await promise;

            expect(ret).toEqual({
                type: 'echo',
                map: new Map([
                    ['key', 'value'],
                    ['key2', 'value2'],
                ]),
            });
        });

        it('should be able pass Set values', async () => {
            worker.postMessage({
                type: 'echo',
                set: new Set(['abc', 'def']),
            });

            await promise;

            expect(ret).toEqual({
                type: 'echo',
                set: new Set(['abc', 'def']),
            });
        });

        it('should be able pass Error values', async () => {
            worker.postMessage({
                type: 'echo',
                error: new Error('my error'),
            });

            await promise;

            expect(ret).toEqual({
                type: 'echo',
                error: new Error('my error'),
            });
        });
    });

    describe('transfer', () => {
        beforeEach(() => {
            worker = new DenoWorker(pingScript);
        });

        it('should be able to pass a MessagePort to the worker', async () => {
            let resolve: any;
            let promise = new Promise((res, rej) => {
                resolve = res;
            });

            let channel = new MessageChannel();
            channel.port1.onmessage = (e) => {
                resolve(e.data);
            };
            worker.postMessage(
                {
                    type: 'port',
                    port: channel.port2,
                },
                [channel.port2]
            );

            channel.port1.postMessage('ping');

            let ret = await promise;

            expect(ret).toEqual('pong');
        });

        it('should be able to recieve a MessagePort from the worker', async () => {
            let resolve: any;
            let promise1 = new Promise<any>((res, rej) => {
                resolve = res;
            });

            worker.onmessage = (e) => {
                resolve(e.data);
            };

            worker.postMessage({
                type: 'request_port',
            });

            let ret = await promise1;

            let promise2 = new Promise<any>((res, rej) => {
                resolve = res;
            });

            expect(ret.type).toEqual('port');
            expect(ret.port).toBeInstanceOf(MessagePort);

            ret.port.onmessage = (e: any) => {
                resolve(e.data);
            };
            ret.port.postMessage('ping');

            let final = await promise2;

            expect(final).toEqual('pong');
        });
    });
});
