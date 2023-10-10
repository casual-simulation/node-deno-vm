import { MessageChannel, MessagePort } from './MessageChannel';
import { execSync } from 'child_process';

export function polyfillMessageChannel() {
    const anyGlobalThis = globalThis as any;
    if (typeof anyGlobalThis.MessageChannel === 'undefined') {
        anyGlobalThis.MessageChannel = MessageChannel;
        anyGlobalThis.MessagePort = MessagePort;
    }
}

/**
 * Forcefully kills the process with the given ID.
 * On Linux/Unix, this means sending the process the SIGKILL signal.
 * On Windows, this means using the taskkill executable to kill the process.
 * @param pid The ID of the process to kill.
 */
export function forceKill(pid: number) {
    const isWindows = /^win/.test(process.platform);
    if (isWindows) {
        return killWindows(pid);
    } else {
        return killUnix(pid);
    }
}

function killWindows(pid: number) {
    execSync(`taskkill /PID ${pid} /T /F`);
}

function killUnix(pid: number) {
    try {
        const signal = 'SIGKILL';
        process.kill(pid, signal);
    } catch (e) {
        // Allow this call to fail with
        // ESRCH, which meant that the process
        // to be killed was already dead.
        // But re-throw on other codes.
        if (e.code !== 'ESRCH') {
            throw e;
        }
    }
}

export interface ExecResult {
    stdout: string;
    stdin: string;
}
