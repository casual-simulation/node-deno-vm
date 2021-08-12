import { DenoWorker } from './DenoWorker';
import { readFileSync } from 'fs';
import path from 'path';
import { URL } from 'url';
import { MessageChannel, MessagePort } from './MessageChannel';
import psList from 'ps-list';
import child_process, { spawn } from 'child_process';

console.log = jest.fn();
jest.setTimeout(10000);

describe('DenoWorker', () => {
    let worker: DenoWorker;
    const echoFile = path.resolve(__dirname, './test/echo.js');
    const echoScript = readFileSync(echoFile, { encoding: 'utf-8' });
    const pingFile = path.resolve(__dirname, './test/ping.js');
    const pingScript = readFileSync(pingFile, { encoding: 'utf-8' });
    const infiniteFile = path.resolve(__dirname, './test/infinite.js');
    const infiniteScript = readFileSync(infiniteFile, { encoding: 'utf-8' });

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

        it('should be able to specify additional network addresses to allow', async () => {
            worker = new DenoWorker(echoScript, {
                permissions: {
                    allowNet: [`https://google.com`],
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

        it('should allow usage of the --unstable flag', async () => {
            const spawnSpy = jest.spyOn(child_process, 'spawn');

            worker = new DenoWorker(echoScript, { denoUnstable: true });

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

            const call = spawnSpy.mock.calls[0];
            expect(call[1]).toContain('--unstable');
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

            // Ports from the worker should have String IDs
            // so they don't interfere with the ones generated from the host.
            expect(typeof ret.port.channelID).toBe('string');

            ret.port.onmessage = (e: any) => {
                resolve(e.data);
            };
            ret.port.postMessage('ping');

            let final = await promise2;

            expect(final).toEqual('pong');
        });
    });

    describe('terminate()', () => {
        it('should kill the deno process when terminated immediately', async () => {
            let denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);

            worker = new DenoWorker(echoScript, {
                permissions: {
                    allowNet: [`https://google.com`],
                },
            });
            worker.terminate();

            denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);
        });

        it('should kill the deno process when terminated after the initial connection', async () => {
            let denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);

            worker = new DenoWorker(echoScript, {
                permissions: {
                    allowNet: [`https://google.com`],
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

            worker.terminate();

            denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);
        });

        it('should kill the deno process when terminated while sending data', async () => {
            let denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);

            worker = new DenoWorker(echoScript, {
                permissions: {
                    allowNet: [`https://google.com`],
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

            worker.terminate();

            worker.postMessage({
                type: 'echo',
                message: 'Hello',
            });

            denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);
        });

        it('should kill the deno process when terminated while recieving data', async () => {
            let denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);

            worker = new DenoWorker(echoScript, {
                permissions: {
                    allowNet: [`https://google.com`],
                },
            });

            let ret: any;
            let resolve: any;
            let promise = new Promise((res, rej) => {
                resolve = res;
            });
            worker.onmessage = (e) => {
                ret = e.data;
                console.log('Message');
                resolve();
            };

            worker.postMessage({
                type: 'echo',
                message: 'Hello',
            });

            await Promise.resolve();

            worker.terminate();

            denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);
        });

        it('should kill the deno process when terminated while the script is in an infinite loop', async () => {
            let denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);

            worker = new DenoWorker(infiniteScript, {
                permissions: {
                    allowNet: [`https://google.com`],
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

            await promise;

            worker.postMessage({
                type: 'echo',
                message: 'Hello',
            });

            worker.terminate();

            denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);
        });
    });
});

async function getDenoProcesses() {
    const list = await psList();
    const denoProcesses = list.filter((p) => /^deno/.test(p.name));
    return denoProcesses;
}
