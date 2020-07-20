import { createServer, Server } from 'http';
import WebSocket, { Server as WSServer } from 'ws';
import {} from 'fs';
import { ChildProcess, spawn } from 'child_process';
import { serializeStructure, deserializeStructure } from './StructureClone';

export type Transferrable = ArrayBuffer;

const DENO_SCRIPT_PATH = './deno/index.ts';

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
    private _onmessageListeners: OnMessageListener[];
    private _available: boolean;
    private _pendingMessages: string[];

    /**
     * Creates a new DenoWorker instance and injects the given script.
     * @param script The JavaScript that the worker should be started with.
     */
    constructor(script: string) {
        this._onmessageListeners = [];
        this._pendingMessages = [];
        this._available = false;
        this._httpServer = createServer();
        this._server = new WSServer({
            server: this._httpServer,
        });
        this._server.on('connection', (socket) => {
            if (this._socket) {
                socket.close();
                return;
            }
            this._socket = socket;
            socket.on('message', (message) => {
                if (typeof message === 'string') {
                    const structuredData = JSON.parse(message);
                    const data = deserializeStructure(structuredData);

                    if (!this._available && data.type === 'init') {
                        this._available = true;
                        let pendingMessages = this._pendingMessages;
                        this._pendingMessages = [];
                        for (let message of pendingMessages) {
                            socket.send(message);
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
            });

            socket.on('close', () => {
                this._available = false;
                this._socket = null;
            });
        });

        this._httpServer.listen({ host: '127.0.0.1', port: 0 }, () => {
            const addr = this._httpServer.address();
            let connectAddress: string;
            let allowAddress: string;
            if (typeof addr === 'string') {
                connectAddress = addr;
            } else {
                connectAddress = `http://${addr.address}:${addr.port}`;
                allowAddress = `${addr.address}:${addr.port}`;
            }

            this._process = spawn('deno', [
                'run',
                '--reload',
                '--quiet',
                `--allow-net=${allowAddress}`,
                DENO_SCRIPT_PATH,
                connectAddress,
                script,
            ]);

            this._process.stdout.setEncoding('utf8');
            this._process.stderr.setEncoding('utf8');
            this._process.stdout.on('data', (data) => {
                console.log('[deno]', data);
            });
            this._process.stderr.on('data', (data) => {
                console.log('[deno]', data);
            });
        });
    }

    /**
     * Represents an event handler for the "message" event, that is a function to be called when a message is recieved from the worker.
     */
    onmessage: (e: MessageEvent) => void = null;

    /**
     * Sends a message to the worker.
     * @param data The data to be sent. Copied via the Structured Clone algorithm so circular references are supported in addition to typed arrays.
     * @param transfer Values that should be transferred. This should include any typed arrays that are referenced in the data.
     */
    postMessage(data: any, transfer?: Transferrable[]): void {
        const structuredData = serializeStructure(data, transfer);
        const json = JSON.stringify(structuredData);
        if (!this._available) {
            this._pendingMessages.push(json);
        } else if (this._socket) {
            this._socket.send(json);
        }
    }

    /**
     * Terminiates the worker and cleans up unused resources.
     */
    terminate() {
        if (this._process) {
            this._process.kill();
            this._process = null;
        }
        if (this._httpServer) {
            this._httpServer.close();
            this._httpServer = null;
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
    addEventListener(type: 'message', listener: OnMessageListener): void {
        if (type === 'message') {
            this._onmessageListeners.push(listener);
        }
    }

    /**
     * Removes the given listener for the "message" event.
     * @param type The type of the event. (Always "message")
     * @param listener The listener to add for the event.
     */
    removeEventListener(type: 'message', listener: OnMessageListener): void {
        if (type === 'message') {
            const index = this._onmessageListeners.indexOf(listener);
            if (index >= 0) {
                this._onmessageListeners.splice(index, 1);
            }
        }
    }
}

export interface OnMessageListener {
    (event: MessageEvent): void;
}

export interface MessageEvent {
    data: any;
}
