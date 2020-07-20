import { DenoWorker } from './DenoWorker';
import { readFileSync } from 'fs';
import path from 'path';

describe('DenoWorker', () => {
    let worker: DenoWorker;

    afterEach(() => {
        if (worker) {
            worker.terminate();
        }
    });

    describe('scripts', () => {
        it('should be able to run the given script', async () => {
            const file = path.resolve(__dirname, './test/echo.js');

            worker = new DenoWorker(readFileSync(file, { encoding: 'utf-8' }));

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
});
