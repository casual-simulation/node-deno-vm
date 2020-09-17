import {
    serializeStructure,
    deserializeStructure,
    Structure,
    StructureWithRefs,
} from './StructureClone.ts';
import { MessageEvent, Transferrable } from './MessageTarget.ts';
import { MessagePort, MessageChannel } from './MessageChannel.ts';

const address = Deno.args[0];
const scriptType = Deno.args[1];
const script = Deno.args[2];

let ports = new Map<number | string, MessagePortData>();

init();

async function init() {
    const socket = new WebSocket(address);

    let onMessage = patchGlobalThis((json) => socket.send(json));

    socket.onmessage = (message) => {
        onMessage(message.data);
    };
    socket.onerror = (err) => {
        console.error(err);
        if (socket.readyState !== WebSocket.CLOSED) {
            socket.close();
        }
    };
    socket.onopen = () => {
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
    };
}

async function sendMessage(message: any, socket: WebSocket) {
    if (socket.readyState !== WebSocket.OPEN) {
        return;
    }
    const structured = serializeStructure(message);
    const json = JSON.stringify(structured);
    return socket.send(json);
}

function patchGlobalThis(send: (json: string) => void) {
    (<any>globalThis).postMessage = (data: any, transfer?: Transferrable[]) =>
        postMessage(null, data, transfer);

    if (typeof (<any>globalThis).MessageChannel === 'undefined') {
        (<any>globalThis).MessageChannel = MessageChannel;
    }
    if (typeof (<any>globalThis).MessagePort === 'undefined') {
        (<any>globalThis).MessagePort = MessagePort;
    }

    return function onmessage(message: string) {
        if (typeof message === 'string') {
            const structuredData = JSON.parse(message) as
                | Structure
                | StructureWithRefs;
            const channel = structuredData.channel;
            const deserialized = deserializeStructure(structuredData);
            const data = deserialized.data;

            if (deserialized.transferred) {
                handleTransfers(deserialized.transferred);
            }

            if (typeof channel === 'number' || typeof channel === 'string') {
                const portData = ports.get(channel);
                if (portData) {
                    portData.recieveData(data);
                } else {
                    console.log('No Port!');
                }
            } else {
                const event = new MessageEvent('message', {
                    data,
                });

                if (typeof (<any>globalThis).onmessage === 'function') {
                    (<any>globalThis).onmessage(event);
                }
                globalThis.dispatchEvent(event);
            }
        }
    };

    function postMessage(
        channel: number | string | null,
        data: any,
        transfer?: Transferrable[]
    ): void {
        if (transfer) {
            handleTransfers(transfer);
        }
        const structuredData = serializeStructure(data, transfer);
        if (typeof channel === 'number' || typeof channel === 'string') {
            structuredData.channel = channel;
        }
        const json = JSON.stringify(structuredData);
        send(json);
    }

    function handleTransfers(transfer?: Transferrable[]) {
        if (transfer) {
            for (let t of transfer) {
                if (t instanceof MessagePort) {
                    const channel = t.channelID;
                    ports.set(t.channelID, {
                        port: t,
                        recieveData: t.transfer((data, list) => {
                            postMessage(channel, data, list);
                        }),
                    });
                }
            }
        }
    }
}

interface MessagePortData {
    port: MessagePort;
    recieveData: (data: any) => void;
}
