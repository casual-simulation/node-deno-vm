import { DenoWorker } from './DenoWorker';
import { readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import path from 'path';
import { URL } from 'url';
import { MessageChannel, MessagePort } from './MessageChannel';
import psList from 'ps-list';
import child_process from 'child_process';

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
    const fetchFile = path.resolve(__dirname, './test/fetch.js');
    const fetchScript = readFileSync(fetchFile, { encoding: 'utf-8' });
    const failFile = path.resolve(__dirname, './test/fail.js');
    const failScript = readFileSync(failFile, { encoding: 'utf-8' });
    const envFile = path.resolve(__dirname, './test/env.js');
    const envScript = readFileSync(envFile, { encoding: 'utf-8' });
    const memoryCrashFile = path.resolve(__dirname, './test/memory.js');
    const unresolvedPromiseFile = path.resolve(
        __dirname,
        './test/unresolved_promise.js'
    );
    const unresolvedPromiseScript = readFileSync(unresolvedPromiseFile, {
        encoding: 'utf-8',
    });

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

        it('should be able to specify network addresses to block', async () => {
            const host = `example.com`;

            worker = new DenoWorker(fetchScript, {
                permissions: {
                    allowNet: true,
                    denyNet: [host],
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
                type: 'fetch',
                url: `https://${host}`,
            });

            await promise;

            expect(ret).toMatchObject({
                type: 'error',
            });
        });

        it('should call onexit when the script fails', async () => {
            worker = new DenoWorker(failScript);

            let exitCode: number;
            let exitSignal: string;
            let resolve: any;
            let promise = new Promise((res, rej) => {
                resolve = res;
            });
            worker.onexit = (code, status) => {
                exitCode = code;
                exitSignal = status;
                resolve();
            };

            let ret: any;
            worker.onmessage = (e) => {
                ret = e.data;
            };

            await promise;

            expect(ret).toBeUndefined();

            const isWindows = /^win/.test(process.platform);
            if (isWindows) {
                expect(exitCode).toBe(1);
                expect(exitSignal).toBe(null);
            } else {
                expect(exitCode).toBe(1);
                expect(exitSignal).toBe(null);
            }
        });

        describe('denoUnstable', async () => {
            afterEach(() => {
                jest.clearAllMocks();
            });

            it('should not include the --unstable flag by default', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript);

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--unstable');
            });

            it('should not include the --unstable flag by when denoUnstable is false', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, { denoUnstable: false });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--unstable');
            });

            it('should include the --unstable flag when denoUnstable is true', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, { denoUnstable: true });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).toContain('--unstable');
            });

            it('should allow fine-grained unstable with an object parameter', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, {
                    denoUnstable: {
                        temporal: true,
                        broadcastChannel: true,
                    },
                });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).toContain('--unstable-temporal');
                expect(args).toContain('--unstable-broadcast-channel');
            });
        });

        describe('unsafelyIgnoreCertificateErrors', async () => {
            afterEach(() => {
                jest.clearAllMocks();
            });

            it('supports the --unsafely-ignore-certificate-errors flag', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(
                    `self.onmessage = (e) => {
    if (e.data.type === 'echo') {
        self.postMessage('hi');
    }
};`,
                    {
                        unsafelyIgnoreCertificateErrors: true,
                    }
                );

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve(e);
                };

                worker.postMessage({
                    type: 'echo',
                });

                expect(await promise).toEqual({ data: 'hi' });

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).toContain(`--unsafely-ignore-certificate-errors`);
            });
        });

        describe('location', async () => {
            afterEach(() => {
                jest.clearAllMocks();
            });

            it('supports the --location flag to specify location.href', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');
                const LOCATION = 'https://xxx.com/';

                worker = new DenoWorker(
                    `self.onmessage = (e) => {
    if (e.data.type === 'echo') {
        self.postMessage(location.href);
    }
};`,
                    {
                        location: LOCATION,
                    }
                );

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve(e);
                };

                worker.postMessage({
                    type: 'echo',
                });

                expect(await promise).toEqual({ data: LOCATION });

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).toContain(`--location=${LOCATION}`);
            });
        });

        describe('denoCachedOnly', async () => {
            afterEach(() => {
                jest.clearAllMocks();
            });

            it('should not include the --cached-only flag by default', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript);

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--cached-only');
            });

            it('should not include the --cached-only flag by when denoCachedOnly is false', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, { denoCachedOnly: false });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--cached-only');
            });

            it('should include the --cached-only flag when denoCachedOnly is true', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, { denoCachedOnly: true });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).toContain('--cached-only');
            });
        });

        describe('denoNoCheck', async () => {
            afterEach(() => {
                jest.clearAllMocks();
            });

            it('should not include the --no-check flag by default', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript);

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--no-check');
            });

            it('should not include the --no-check flag by when denoNoCheck is false', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, { denoNoCheck: false });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--no-check');
            });

            it('should include the --no-check flag when denoNoCheck is true', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, { denoNoCheck: true });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).toContain('--no-check');
            });
        });

        describe('denoImportMapPath', async () => {
            afterEach(() => {
                jest.clearAllMocks();
            });

            it('should not include --import-map by default', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript);

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--import-map');
            });

            it('should not set --import-map by when denoImportMapPath is empty', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, { denoImportMapPath: '' });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--import-map');
            });

            it('should set --import-map when denoImportMapPath is nonempty', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');
                const importMapPath = path.resolve(
                    './src/test/import_map.json'
                );
                worker = new DenoWorker(echoScript, {
                    denoImportMapPath: importMapPath,
                });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).toContain(`--import-map=${importMapPath}`);
            });
        });

        describe('denoLockFilePath', async () => {
            /*
             * generateLockFile() shells out to deno to create a lock file from index.ts`. This lock file is created
             * to be a temporary file (stored in the gitignored ./tmp) It returns the fully qualified path to the temp
             * file as a string. Cleanup is to handled by the test cleanup.
             */
            function generateLockFile(): Promise<string> {
                const tmpDirPath = path.resolve('./tmp');
                if (!existsSync(tmpDirPath)) {
                    mkdirSync(tmpDirPath);
                }
                const lockFileName = randomBytes(32).toString('hex');
                const lockFilePath = path.join(tmpDirPath, lockFileName);
                lockFiles.add(lockFilePath);

                const denoIndexPath = path.resolve('./deno/index.ts');
                const process = child_process.exec(
                    `deno cache --lock=${lockFilePath} --lock-write ${denoIndexPath}`
                );
                const promise = new Promise<string>((res) => {
                    process.on('exit', () => res(lockFilePath));
                });
                return promise;
            }

            let lockFiles: Set<string>;
            beforeEach(() => {
                lockFiles = new Set<string>();
            });

            afterEach(() => {
                lockFiles.forEach((file) => unlinkSync(file));
                jest.clearAllMocks();
            });

            it('should not include --lock by default', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript);

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--lock');
            });

            it('should not set --lock by when denoLockFilePath is empty', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, { denoLockFilePath: '' });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--lock');
            });

            it('should set --lock when denoLockFilePath is nonempty', async () => {
                const lockFilePath = await generateLockFile();

                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, {
                    denoLockFilePath: lockFilePath,
                });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;
                worker.terminate();

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).toContain(`--lock=${lockFilePath}`);
            });
        });

        describe('denoConfig', async () => {
            afterEach(() => {
                jest.clearAllMocks();
            });

            it('should not include --config by default', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript);

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--config');

                // should pass --no-config when denoConfig is omitted
                expect(args).toContain('--no-config');
            });

            it('should not set --config by when denoConfig is empty', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, { denoConfig: '' });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--config');

                // should pass --no-config when denoConfig is empty
                expect(args).toContain('--no-config');
            });

            it('should set --config when denoConfig is nonempty', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');
                const configPath = path.resolve('./src/test/deno.json');
                worker = new DenoWorker(echoScript, {
                    denoConfig: configPath,
                });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).toContain(`--config=${configPath}`);
            });
        });

        describe('denoExtraFlags', async () => {
            afterEach(() => {
                jest.clearAllMocks();
            });

            it('should include the given extra flags', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, {
                    denoExtraFlags: ['--unstable', '--inspect'],
                });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).toContain('--unstable');
                expect(args).toContain('--inspect');
            });
        });

        describe('denoV8Flags', async () => {
            afterEach(() => {
                jest.clearAllMocks();
            });

            it('should not include --v8-flags by default', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript);

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--v8-flags');
            });

            it('should not set --v8-flags by when denoV8Flags is empty', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');

                worker = new DenoWorker(echoScript, { denoV8Flags: [] });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).not.toContain('--v8-flags');
            });

            it('should set --v8-flags denoV8Flags has a single flag set ', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');
                worker = new DenoWorker(echoScript, {
                    denoV8Flags: ['--max-old-space-size=2048'],
                });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).toContain(`--v8-flags=--max-old-space-size=2048`);
            });

            it('should set --v8-flags when denoV8Flags has multiple flags set', async () => {
                const spawnSpy = jest.spyOn(child_process, 'spawn');
                worker = new DenoWorker(echoScript, {
                    denoV8Flags: [
                        '--max-old-space-size=2048',
                        '--max-heap-size=2048',
                    ],
                });

                let resolve: any;
                let promise = new Promise((res, rej) => {
                    resolve = res;
                });
                worker.onmessage = (e) => {
                    resolve();
                };

                worker.postMessage({
                    type: 'echo',
                    message: 'Hello',
                });

                await promise;

                const call = spawnSpy.mock.calls[0];
                const [_deno, args] = call;
                expect(args).toContain(
                    `--v8-flags=--max-old-space-size=2048,--max-heap-size=2048`
                );
            });
        });

        describe('spawnOptions', async () => {
            it('should be able to pass spawn options', async () => {
                worker = new DenoWorker(envScript, {
                    permissions: {
                        allowEnv: true,
                    },
                    spawnOptions: {
                        env: {
                            ...process.env,
                            HELLO: 'WORLD',
                        },
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
                    type: 'env',
                    name: 'HELLO',
                });

                await promise;

                expect(ret).toEqual('WORLD');
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

        it('should call onexit', async () => {
            let denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);

            worker = new DenoWorker(echoScript, {
                permissions: {
                    allowNet: [`https://google.com`],
                },
            });
            let exitCode: number;
            let exitSignal: string;
            worker.onexit = (code, signal) => {
                exitCode = code;
                exitSignal = signal;
            };

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

            expect(exitCode).toBeUndefined();
            expect(exitSignal).toBeUndefined();

            worker.terminate();

            denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);

            const isWindows = /^win/.test(process.platform);
            if (isWindows) {
                expect(exitCode).toBe(1);
                expect(exitSignal).toBe(null);
            } else {
                expect(exitCode).toBe(null);
                expect(exitSignal).toBe('SIGKILL');
            }
        });

        it('should gracefully handle Deno out-of-memory', async () => {
            let denoProcesses = await getDenoProcesses();
            expect(denoProcesses).toEqual([]);
            worker = new DenoWorker(memoryCrashFile, {
                denoV8Flags: ['--max-heap-size=10'],
                logStdout: true,
            });
            worker.postMessage({});

            const exitValues = await new Promise<
                [number | null, string | null]
            >((resolve) => {
                worker.onexit = (...args) => resolve(args);
            });

            const isWindows = /^win/.test(process.platform);

            if (isWindows) {
                expect(typeof exitValues[0]).toEqual('number');
                expect(exitValues[1]).toEqual(null);
            } else {
                expect(exitValues).toEqual([null, 'SIGTRAP']);
            }

            worker.terminate();
        });
    });

    describe('closeSocket()', () => {
        it('should allow natural exit if closeSocket is called after message is received', async () => {
            worker = new DenoWorker(unresolvedPromiseScript);

            let resolveExit: any;
            let exit = new Promise((resolve) => {
                resolveExit = resolve;
            });
            worker.onexit = () => resolveExit();

            await new Promise<void>(
                (resolve) =>
                    (worker.onmessage = (e) => {
                        worker.closeSocket();
                        resolve();
                    })
            );

            await exit;
        });

        it('should allow natural exit if closeSocket is called before socket is open', async () => {
            worker = new DenoWorker(unresolvedPromiseScript);

            let resolveExit: any;
            let exit = new Promise((resolve) => {
                resolveExit = resolve;
            });
            worker.onexit = () => resolveExit();

            worker.closeSocket();

            await exit;
        });
    });
});

async function getDenoProcesses() {
    const list = await psList();
    const denoProcesses = list.filter(
        (p) => /^deno/.test(p.name) && p.cmd !== 'deno lsp'
    );
    return denoProcesses;
}
