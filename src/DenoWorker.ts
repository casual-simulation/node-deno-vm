import { createServer, Server } from 'http';
import WebSocket, { Server as WSServer } from 'ws';
import { resolve } from 'path';
import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import {
    serializeStructure,
    deserializeStructure,
    Structure,
} from './StructureClone';
import { URL } from 'url';
import process from 'process';
import {
    OnMessageListener,
    MessageEvent,
    Transferrable,
    OnExitListener,
} from './MessageTarget';
import { MessagePort } from './MessageChannel';
import { Stream, Readable, Duplex } from 'stream';
import { forceKill } from './Utils';

const DEFAULT_DENO_BOOTSTRAP_SCRIPT_PATH = __dirname.endsWith('src')
    ? resolve(__dirname, '../deno/index.ts')
    : resolve(__dirname, '../../deno/index.ts');

export interface DenoWorkerOptions {
    /**
     * The path to the executable that should be use when spawning the subprocess.
     * Defaults to "deno".
     */
    denoExecutable: string;

    /**
     * The path to the script that should be used to bootstrap the worker environment in Deno.
     * If specified, this script will be used instead of the default bootstrap script.
     * Only advanced users should set this.
     */
    denoBootstrapScriptPath: string;

    /**
     * Whether to reload scripts.
     * If given a list of strings then only the specified URLs will be reloaded.
     * Defaults to false when NODE_ENV is set to "production" and true otherwise.
     */
    reload: boolean | string[];

    /**
     * Whether to log stdout from the worker.
     * Defaults to true.
     */
    logStdout: boolean;

    /**
     * Whether to log stderr from the worker.
     * Defaults to true.
     */
    logStderr: boolean;

    /**
     * Whether to use Deno's unstable features
     */
    denoUnstable:
        | boolean
        | {
              /**
               * Enable unstable bare node builtins feature
               */
              bareNodeBuiltins?: boolean;

              /**
               *  Enable unstable 'bring your own node_modules' feature
               */
              byonm?: boolean;

              /**
               * Enable unstable resolving of specifiers by extension probing,
               * .js to .ts, and directory probing.
               */
              sloppyImports?: boolean;

              /**
               * Enable unstable `BroadcastChannel` API
               */
              broadcastChannel?: boolean;

              /**
               * Enable unstable Deno.cron API
               */
              cron?: boolean;

              /**
               * Enable unstable FFI APIs
               */
              ffi?: boolean;

              /**
               * Enable unstable file system APIs
               */
              fs?: boolean;

              /**
               * Enable unstable HTTP APIs
               */
              http?: boolean;

              /**
               * Enable unstable Key-Value store APIs
               */
              kv?: boolean;

              /**
               * Enable unstable net APIs
               */
              net?: boolean;

              /**
               * Enable unstable Temporal API
               */
              temporal?: boolean;

              /**
               * Enable unsafe __proto__ support. This is a security risk.
               */
              unsafeProto?: boolean;

              /**
               * Enable unstable `WebGPU` API
               */
              webgpu?: boolean;

              /**
               * Enable unstable Web Worker APIs
               */
              workerOptions?: boolean;
          };

    /**
     * V8 flags to be set when starting Deno
     */
    denoV8Flags: string[];

    /**
     * Path where deno can find an import map
     */
    denoImportMapPath: string;

    /**
     * Path where deno can find a lock file
     */
    denoLockFilePath: string;

    /**
     * Whether to disable fetching uncached dependencies
     */
    denoCachedOnly: boolean;

    /**
     * Whether to disable typechecking when starting Deno
     */
    denoNoCheck: boolean;

    /**
     * Allow Deno to make requests to hosts with certificate
     * errors.
     */
    unsafelyIgnoreCertificateErrors: boolean;

    /**
     * Specify the --location flag, which defines location.href.
     * This must be a valid URL if provided.
     */
    location: string;

    /**
     * The permissions that the Deno worker should use.
     */
    permissions: {
        /**
         * Whether to allow all permissions.
         * Defaults to false.
         */
        allowAll?: boolean;

        /**
         * Whether to allow network connnections.
         * If given a list of strings then only the specified origins/paths are allowed.
         * Defaults to false.
         */
        allowNet?: boolean | string[];

        /**
         * Disable network access to provided IP addresses or hostnames. Any addresses
         * specified here will be denied access, even if they are specified in
         * `allowNet`. Note that deno-vm needs a network connection between the host
         * and the guest, so it's not possible to fully disable network access.
         */
        denyNet?: string[];

        /**
         * Whether to allow reading from the filesystem.
         * If given a list of strings then only the specified file paths are allowed.
         * Defaults to false.
         */
        allowRead?: boolean | string[];

        /**
         * Whether to allow writing to the filesystem.
         * If given a list of strings then only the specified file paths are allowed.
         * Defaults to false.
         */
        allowWrite?: boolean | string[];

        /**
         * Whether to allow reading environment variables.
         * Defaults to false.
         */
        allowEnv?: boolean | string[];

        /**
         * Whether to allow running Deno plugins.
         * Defaults to false.
         */
        allowPlugin?: boolean;

        /**
         * Whether to allow running subprocesses.
         * Defaults to false.
         */
        allowRun?: boolean | string[];

        /**
         * Whether to allow high resolution time measurement.
         * Defaults to false.
         */
        allowHrtime?: boolean;
    };

    /**
     * Options used to spawn the Deno child process
     */
    spawnOptions: SpawnOptions;
}

/**
 * The DenoWorker class is a WebWorker-like interface for interacting with Deno.
 *
 * Because Deno is an isolated environment, this worker gives you the ability to run untrusted JavaScript code without
 * potentially compromising your system.
 */
export class DenoWorker {
    private _httpServer: Server;
    private _server: WSServer;
    private _process: ChildProcess;
    private _socket: WebSocket;
    private _socketClosed: boolean;
    private _onmessageListeners: OnMessageListener[];
    private _onexitListeners: OnExitListener[];
    private _available: boolean;
    private _pendingMessages: string[];
    private _options: DenoWorkerOptions;
    private _ports: Map<number | string, MessagePortData>;
    private _terminated: boolean;
    private _stdout: Readable;
    private _stderr: Readable;
    private _failureError?: string;

    /**
     * Creates a new DenoWorker instance and injects the given script.
     * @param script The JavaScript that the worker should be started with.
     */
    constructor(script: string | URL, options?: Partial<DenoWorkerOptions>) {
        this._onmessageListeners = [];
        this._onexitListeners = [];
        this._pendingMessages = [];
        this._available = false;
        this._socketClosed = false;
        this._stdout = new Readable();
        this._stdout.setEncoding('utf-8');
        this._stderr = new Readable();
        this._stdout.setEncoding('utf-8');
        this._stderr.setEncoding('utf-8');
        this._options = Object.assign(
            {
                denoExecutable: 'deno',
                denoBootstrapScriptPath: DEFAULT_DENO_BOOTSTRAP_SCRIPT_PATH,
                reload: process.env.NODE_ENV !== 'production',
                logStdout: true,
                logStderr: true,
                denoUnstable: false,
                location: undefined,
                permissions: {},
                denoV8Flags: [],
                denoImportMapPath: '',
                denoLockFilePath: '',
                denoCachedOnly: false,
                denoNoCheck: false,
                unsafelyIgnoreCertificateErrors: false,
                spawnOptions: {},
            },
            options || {}
        );

        this._ports = new Map();
        this._httpServer = createServer();
        this._server = new WSServer({
            server: this._httpServer,
        });
        this._server.on('connection', (socket) => {
            if (this._socket) {
                socket.close();
                return;
            }
            if (this._socketClosed) {
                socket.close();
                this._socket = null;
                return;
            }
            this._socket = socket;
            socket.on('message', (message) => {
                if (typeof message === 'string') {
                    const structuredData = JSON.parse(message) as Structure;
                    const channel = structuredData.channel;
                    const deserialized = deserializeStructure(structuredData);
                    const data = deserialized.data;

                    if (deserialized.transferred) {
                        this._handleTransferrables(deserialized.transferred);
                    }

                    if (!this._available && data && data.type === 'init') {
                        this._available = true;
                        let pendingMessages = this._pendingMessages;
                        this._pendingMessages = [];
                        for (let message of pendingMessages) {
                            socket.send(message);
                        }
                    } else {
                        if (
                            typeof channel === 'number' ||
                            typeof channel === 'string'
                        ) {
                            const portData = this._ports.get(channel);
                            if (portData) {
                                portData.recieveData(data);
                            }
                        } else {
                            const event = {
                                data,
                            } as MessageEvent;
                            if (this.onmessage) {
                                this.onmessage(event);
                            }
                            for (let onmessage of this._onmessageListeners) {
                                onmessage(event);
                            }
                        }
                    }
                }
            });

            socket.on('close', () => {
                this._available = false;
                this._socket = null;
            });
        });

        this._httpServer.listen({ host: '127.0.0.1', port: 0 }, () => {
          try {
            if (this._terminated) {
                this._httpServer.close();
                return;
            }
            const addr = this._httpServer.address();
            let connectAddress: string;
            let allowAddress: string;
            if (typeof addr === 'string') {
                connectAddress = addr;
            } else {
                connectAddress = `ws://${addr.address}:${addr.port}`;
                allowAddress = `${addr.address}:${addr.port}`;
            }

            let scriptArgs: string[];

            if (typeof script === 'string') {
                scriptArgs = ['script', script];
            } else {
                scriptArgs = ['import', script.href];
            }

            let runArgs = [] as string[];

            addOption(runArgs, '--reload', this._options.reload);
            if (this._options.denoUnstable === true) {
                runArgs.push('--unstable');
            } else if (this._options.denoUnstable) {
                for (let [key] of Object.entries(
                    this._options.denoUnstable
                ).filter(([_key, val]) => val)) {
                    runArgs.push(
                        `--unstable-${key.replace(
                            /[A-Z]/g,
                            (m) => '-' + m.toLowerCase()
                        )}`
                    );
                }
            }
            addOption(runArgs, '--cached-only', this._options.denoCachedOnly);
            addOption(runArgs, '--no-check', this._options.denoNoCheck);
            addOption(
                runArgs,
                '--unsafely-ignore-certificate-errors',
                this._options.unsafelyIgnoreCertificateErrors
            );
            if (this._options.location) {
                addOption(runArgs, '--location', [this._options.location]);
            }

            if (this._options.denoV8Flags.length > 0) {
                addOption(runArgs, '--v8-flags', this._options.denoV8Flags);
            }

            if (this._options.denoImportMapPath) {
                addOption(runArgs, '--import-map', [
                    this._options.denoImportMapPath,
                ]);
            }

            if (this._options.denoLockFilePath) {
                addOption(runArgs, '--lock', [this._options.denoLockFilePath]);
            }

            if (this._options.permissions) {
                addOption(
                    runArgs,
                    '--allow-all',
                    this._options.permissions.allowAll
                );
                if (!this._options.permissions.allowAll) {
                    addOption(
                        runArgs,
                        '--allow-net',
                        typeof this._options.permissions.allowNet === 'boolean'
                            ? this._options.permissions.allowNet
                            : this._options.permissions.allowNet
                            ? [
                                  ...this._options.permissions.allowNet,
                                  allowAddress,
                              ]
                            : [allowAddress]
                    );
                    // Ensures the `allowAddress` isn't denied
                    const deniedAddresses = this._options.permissions.denyNet?.filter(
                        (address) => address !== allowAddress
                    );
                    addOption(
                        runArgs,
                        '--deny-net',
                        // Ensures an empty array isn't used
                        deniedAddresses?.length ? deniedAddresses : false
                    );
                    addOption(
                        runArgs,
                        '--allow-read',
                        this._options.permissions.allowRead
                    );
                    addOption(
                        runArgs,
                        '--allow-write',
                        this._options.permissions.allowWrite
                    );
                    addOption(
                        runArgs,
                        '--allow-env',
                        this._options.permissions.allowEnv
                    );
                    addOption(
                        runArgs,
                        '--allow-plugin',
                        this._options.permissions.allowPlugin
                    );
                    addOption(
                        runArgs,
                        '--allow-hrtime',
                        this._options.permissions.allowHrtime
                    );
                }
            }

            this._process = spawn(
                this._options.denoExecutable,
                [
                    'run',
                    ...runArgs,
                    this._options.denoBootstrapScriptPath,
                    connectAddress,
                    ...scriptArgs,
                ],
                this._options.spawnOptions
            );
            this._process.on('exit', (code: number, signal: string) => {
                this.terminate();

                if (this.onexit) {
                    this.onexit(code, signal);
                }
                for (let onexit of this._onexitListeners) {
                    onexit(code, signal);
                }
            });

            this._stdout = <Readable>this._process.stdout;
            this._stderr = <Readable>this._process.stderr;

            if (this._options.logStdout) {
                this.stdout.setEncoding('utf-8');
                this.stdout.on('data', (data) => {
                    console.log('[deno]', data);
                });
            }
            if (this._options.logStderr) {
                this.stderr.setEncoding('utf-8');
                this.stderr.on('data', (data) => {
                    console.log('[deno]', data);
                });
            }
          } catch(e) {
              this._failureError = `Failed to start Deno worker server: ${e.message}`;
              // Informing client about the server failure
              this.onexit?.(e.errno ?? -1, this._failureError);
              throw e;
          }
        });
    }

    get stdout() {
        return this._stdout;
    }

    get stderr() {
        return this._stderr;
    }

    /**
     * Represents an event handler for the "message" event, that is a function to be called when a message is recieved from the worker.
     */
    onmessage: (e: MessageEvent) => void = null;

    /**
     * Represents an event handler for the "exit" event. That is, a function to be called when the Deno worker process is terminated.
     */
    onexit: (code: number, signal: string) => void = null;

    /**
     * Sends a message to the worker.
     * @param data The data to be sent. Copied via the Structured Clone algorithm so circular references are supported in addition to typed arrays.
     * @param transfer Values that should be transferred. This should include any typed arrays that are referenced in the data.
     */
    postMessage(data: any, transfer?: Transferrable[]): void {
        return this._postMessage(null, data, transfer);
    }

    /**
     * Closes the websocket, which may allow the process to exit natually.
     */
    closeSocket() {
        this._socketClosed = true;
        if (this._socket) {
            this._socket.close();
            this._socket = null;
        }
    }

    /**
     * Terminates the worker and cleans up unused resources.
     */
    terminate() {
        this._terminated = true;
        this._socketClosed = true;
        if (this._process && this._process.exitCode === null) {
            // this._process.kill();
            forceKill(this._process.pid);
        }
        this._process = null;
        if (this._httpServer) {
            this._httpServer.close();
        }
        if (this._server) {
            this._server.close();
            this._server = null;
        }
        this._socket = null;
        this._pendingMessages = null;
    }

    /**
     * Adds the given listener for the "message" event.
     * @param type The type of the event. (Always "message")
     * @param listener The listener to add for the event.
     */
    addEventListener(type: 'message', listener: OnMessageListener): void;

    /**
     * Adds the given listener for the "exit" event.
     * @param type The type of the event. (Always "exit")
     * @param listener The listener to add for the event.
     */
    addEventListener(type: 'exit', listener: OnExitListener): void;

    /**
     * Adds the given listener for the "message" or "exit" event.
     * @param type The type of the event. (Always either "message" or "exit")
     * @param listener The listener to add for the event.
     */
    addEventListener(
        type: 'message' | 'exit',
        listener: OnMessageListener | OnExitListener
    ): void {
        if (type === 'message') {
            this._onmessageListeners.push(listener as OnMessageListener);
        } else if (type === 'exit') {
            this._onexitListeners.push(listener as OnExitListener);
        }
    }

    /**
     * Removes the given listener for the "message" event.
     * @param type The type of the event. (Always "message")
     * @param listener The listener to remove for the event.
     */
    removeEventListener(type: 'message', listener: OnMessageListener): void;

    /**
     * Removes the given listener for the "exit" event.
     * @param type The type of the event. (Always "exit")
     * @param listener The listener to remove for the event.
     */
    removeEventListener(type: 'exit', listener: OnExitListener): void;

    /**
     * Removes the given listener for the "message" or "exit" event.
     * @param type The type of the event. (Always either "message" or "exit")
     * @param listener The listener to remove for the event.
     */
    removeEventListener(
        type: 'message' | 'exit',
        listener: OnMessageListener | OnExitListener
    ): void {
        if (type === 'message') {
            const index = this._onmessageListeners.indexOf(
                listener as OnMessageListener
            );
            if (index >= 0) {
                this._onmessageListeners.splice(index, 1);
            }
        }
        if (type === 'exit') {
            const index = this._onexitListeners.indexOf(
                listener as OnExitListener
            );
            if (index >= 0) {
                this._onexitListeners.splice(index, 1);
            }
        }
    }

    private _postMessage(
        channel: number | string | null,
        data: any,
        transfer?: Transferrable[]
    ) {
        // Prevent collecting messages if the server is down
        if(this._failureError) {
            throw new Error(this._failureError);
        }
        if (this._terminated) {
            return;
        }
        this._handleTransferrables(transfer);
        const structuredData = serializeStructure(data, transfer);
        if (channel !== null) {
            structuredData.channel = channel;
        }
        const json = JSON.stringify(structuredData);
        if (!this._available) {
            this._pendingMessages.push(json);
        } else if (this._socket) {
            this._socket.send(json);
        }
    }

    private _handleTransferrables(transfer?: Transferrable[]) {
        if (transfer) {
            for (let t of transfer) {
                if (t instanceof MessagePort) {
                    if (!t.transferred) {
                        const channelID = t.channelID;
                        this._ports.set(t.channelID, {
                            port: t,
                            recieveData: t.transfer((data, transfer) => {
                                this._postMessage(channelID, data, transfer);
                            }),
                        });
                    }
                }
            }
        }
    }
}

function addOption(list: string[], name: string, option: boolean | string[]) {
    if (option === true) {
        list.push(`${name}`);
    } else if (Array.isArray(option)) {
        let values = option.join(',');
        list.push(`${name}=${values}`);
    }
}

interface MessagePortData {
    port: MessagePort;
    recieveData: (data: any) => void;
}
