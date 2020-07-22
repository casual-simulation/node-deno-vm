import { connectWebSocket, WebSocket } from 'https://deno.land/std/ws/mod.ts';
import {
    serializeStructure,
    deserializeStructure,
    Transferrable,
} from './StructureClone.ts';
import { MessageEvent } from './MessageTarget.ts';

const address = Deno.args[0];
const scriptType = Deno.args[1];
const script = Deno.args[2];

init();

async function init() {
    const socket = await connectWebSocket(address);

    let onMessage = patchGlobalThis((json) => socket.send(json));

    const messages = async (): Promise<void> => {
        for await (const message of socket) {
            if (typeof message === 'string') {
                onMessage(message);
            }
        }
    };

    messages().catch((err) => {
        console.error(err);
        if (!socket.isClosed) {
            socket.close();
        }
    });

    sendMessage(
        {
            type: 'init',
        },
        socket
    );

    if (scriptType === 'script') {
        Function(script)();
    } else if (scriptType === 'import') {
        import(script);
    } else {
        throw new Error('Unsupported scrypt type: ' + scriptType);
    }
}

async function sendMessage(message: any, socket: WebSocket) {
    const structured = serializeStructure(message);
    const json = JSON.stringify(structured);
    return socket.send(json);
}

function patchGlobalThis(send: (json: string) => void) {
    (<any>globalThis).postMessage = postMessage;

    return function onmessage(message: string) {
        if (typeof message === 'string') {
            const structuredData = JSON.parse(message);
            const data = deserializeStructure(structuredData);

            const event = new MessageEvent('message', {
                data,
            });

            if (typeof (<any>globalThis).onmessage === 'function') {
                (<any>globalThis).onmessage(event);
            }
            globalThis.dispatchEvent(event);
        }
    };

    function postMessage(data: any, transfer?: Transferrable[]): void {
        const structuredData = serializeStructure(data, transfer);
        const json = JSON.stringify(structuredData);
        send(json);
    }
}
