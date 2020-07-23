import { MessageChannel, MessagePort } from './MessageChannel';

export function polyfillMessageChannel() {
    const anyGlobalThis = globalThis as any;
    if (typeof anyGlobalThis.MessageChannel === 'undefined') {
        anyGlobalThis.MessageChannel = MessageChannel;
        anyGlobalThis.MessagePort = MessagePort;
    }
}
