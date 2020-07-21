import { DenoWorker } from './DenoWorker';
import { readFileSync } from 'fs';
import path from 'path';
import { URL } from 'url';

console.log = jest.fn();

describe('DenoWorker', () => {
    let worker: DenoWorker;
    const file = path.resolve(__dirname, './test/echo.js');
    const echoScript = readFileSync(file, { encoding: 'utf-8' });

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
});
