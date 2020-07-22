import { MessageChannel } from './MessageChannel';
import { MessageEvent } from './MessageTarget';

describe('MessageChannel', () => {
    it('messages sent on port1 should end up on port2', () => {
        const channel = new MessageChannel();

        let event: MessageEvent;
        channel.port2.onmessage = (e) => {
            event = e;
        };

        channel.port1.postMessage({
            hello: 'world',
        });

        expect(event).toEqual({
            data: {
                hello: 'world',
            },
        });
    });

    it('messages sent on port2 should end up on port1', () => {
        const channel = new MessageChannel();

        let event: MessageEvent;
        channel.port1.onmessage = (e) => {
            event = e;
        };

        channel.port2.postMessage({
            hello: 'world',
        });

        expect(event).toEqual({
            data: {
                hello: 'world',
            },
        });
    });

    it('should be able to transfer() a MessagePort to take control of the serialization', () => {
        const channel = new MessageChannel();

        let sent = [] as any[];
        const recieveMessage = channel.port1.transfer((data, list) => {
            sent.push([data, list]);
        });

        channel.port1.postMessage({
            hello: 'world',
        });

        expect(sent).toEqual([
            [
                {
                    hello: 'world',
                },
                undefined,
            ],
        ]);

        let event: MessageEvent;
        channel.port2.onmessage = (e) => {
            event = e;
        };

        recieveMessage({
            wow: true,
        });

        expect(event).toEqual({
            data: { wow: true },
        });
    });
});
