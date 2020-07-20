import { connectWebSocket, WebSocket } from 'https://deno.land/std/ws/mod.ts';

const port = parseInt(Deno.args[0]);

init();

async function init() {
    const socket = await connectWebSocket(`http://127.0.0.1:${port}`);

    const messages = async (): Promise<void> => {
        for await (const message of socket) {
            console.log('Got Message!');
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
}

async function sendMessage(message: any, socket: WebSocket) {
    return socket.send(JSON.stringify(message));
}
