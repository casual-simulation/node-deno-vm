import WebSocket, { Server } from 'ws';
import { spawn } from 'child_process';
import { MessagePort } from 'worker_threads';

export type Transferrable = ArrayBuffer;

export class DenoWorker {
    constructor(file: string) {}

    onmessage(e: any): void {}

    postMessage(data: any, transfer?: Transferrable[]): void {}
}
