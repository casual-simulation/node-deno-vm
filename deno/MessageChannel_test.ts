import {
    assertEquals,
    assert,
    assertThrows,
} from 'https://deno.land/std/testing/asserts.ts';
import { MessageChannel } from './MessageChannel.ts';
import { MessageEvent } from './MessageTarget.ts';

Deno.test('messages sent on port1 should end up on port2', () => {
    const channel = new MessageChannel();

    let event: MessageEvent | null = null;
    channel.port2.onmessage = (e) => {
        event = e;
    };

    channel.port1.postMessage({
        hello: 'world',
    });

    assertEquals(event, {
        data: {
            hello: 'world',
        },
    });
});

Deno.test('messages sent on port2 should end up on port1', () => {
    const channel = new MessageChannel();

    let event: MessageEvent | null = null;
    channel.port1.onmessage = (e) => {
        event = e;
    };

    channel.port2.postMessage({
        hello: 'world',
    });

    assertEquals(event, {
        data: {
            hello: 'world',
        },
    });
});

Deno.test(
    'should be able to transfer() a MessagePort to take control of the serialization',
    () => {
        const channel = new MessageChannel();

        let sent = [] as any[];
        const recieveMessage = channel.port1.transfer((data, list) => {
            sent.push([data, list]);
        });

        channel.port1.postMessage({
            hello: 'world',
        });

        assertEquals(sent, [
            [
                {
                    hello: 'world',
                },
                undefined,
            ],
        ]);

        let event: MessageEvent | null = null;
        channel.port2.onmessage = (e) => {
            event = e;
        };

        recieveMessage({
            wow: true,
        });

        assertEquals(event, {
            data: { wow: true },
        });
    }
);
