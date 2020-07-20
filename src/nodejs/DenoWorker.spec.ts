import { DenoWorker } from './DenoWorker';
import path from 'path';

describe('DenoWorker', () => {
    let worker: DenoWorker;

    describe('scripts', () => {
        it('should be able to run the given script', () => {
            const file = path.resolve(__dirname, './test/script.js');

            worker = new DenoWorker(file);

            let ret: any;
            worker.onmessage = (e) => {
                ret = JSON.parse(e.data);
            };

            worker.postMessage(
                JSON.stringify({
                    type: 'echo',
                    message: 'Hello',
                })
            );

            expect(ret).toEqual({
                type: 'echo',
                message: 'Hello',
            });
        });
    });
});
