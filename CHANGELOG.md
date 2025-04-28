# Changelog

## v0.13.0

### Date: 4/28/2025

### Changes:

-   Added `denoNoConfig` and `denoNoNPM` options to DenoWorker.
    -   They default to `true` to prevent Deno from trying to load or interact with other files/configurations.
    -   Also at least one of them needs to be set to `true` for DenoWorker to be able to load the bootstrap script from `node_modules` (see [#54 for more info](https://github.com/casual-simulation/node-deno-vm/issues/54)).

## v0.12.0

### Date: 4/12/2024

### Changes:

-   Added `unsafelyIgnoreCertificateErrors` option to DenoWorker to let users skip
    SSL verification.

## v0.11.0

### Date: 4/01/2024

### Changes:

-   Added `location` option to DenoWorker to let users customize location.href and scoping for caches

## v0.10.4

### Date: 2/08/2024

### Changes:

-   Updated `removeEventListener` to also remove `exit` events.

## v0.10.3

### Date: 2/02/2024

### Changes:

-   Make the minimum Node version 12
-   It's now possible to specify an object for `denoUnstable`, which can let you enable more fine-grained unstable flags.

```ts
new DenoWorker(echoScript, {
    denoUnstable: {
        temporal: true,
        broadcastChannel: true,
    },
});
```

## v0.10.2

### Date: 1/29/2024

### Changes:

-   Added the `denyNet` option to DenoWorker.
    -   This matches the `--deny-net` option in the Deno CLI: https://docs.deno.com/runtime/manual/basics/permissions#permissions-list
    -   Thanks to [@andreterron](https://github.com/andreterron) for contributing this! ([#41](https://github.com/casual-simulation/node-deno-vm/pull/41))

## v0.10.1

### Date: 12/21/2023

### Changes:

-   Update base64 imports to support Deno std 0.210.0.
    -   Thanks to [@andreterron](https://github.com/andreterron) for contributing this! ([#40](https://github.com/casual-simulation/node-deno-vm/pull/40))

## v0.10.0

### Date: 11/20/2023

### Changes:

-   Added the ability to close the websocket connection to the Deno subprocess with `.closeSocket()`.
    -   Thanks to [@andreterron](https://github.com/andreterron) for contributing this! ([#39](https://github.com/casual-simulation/node-deno-vm/pull/39))

## v0.9.1

### Date: 10/11/2023

### Changes:

-   Fixed an issue where `DenoWorker` would throw an error when the child Deno process runs out of memory.
    -   Thanks to [@tmcw](https://github.com/tmcw) for contributing this! ([#34](https://github.com/casual-simulation/node-deno-vm/pull/34))

## v0.9.0

### Date: 9/15/2023

### Changes:

-   Added the `spawnOptions` configuration option.
    -   Useful for customizing how Node spawns the Deno child process.
    -   Thanks to [@andreterron](https://github.com/andreterron) for contributing this! ([#31](https://github.com/casual-simulation/node-deno-vm/pull/31))

## v0.8.4

### Date: 1/24/2023

### Changes:

-   Added the `exit` event.
    -   This event is triggered on `DenoWorker` instances when the Deno child process exits.
    -   Available via the `onexit` property or by using `worker.addEventListener("exit", listener)`.

## v0.8.3

### Date: 12/15/2021

### Changes:

-   Added the `denoNoCheck` option to `DenoWorker` for the `--no-check` flag.
    -   Thanks to [@derekwheel](https://github.com/derekwheel) for contributing this! ([#13](https://github.com/casual-simulation/node-deno-vm/pull/13))

## v0.8.2

### Date: 12/13/2021

### Changes:

-   Added the `denoV8Flags`, `denoImportMapPath`, `denoCachedOnly`, and `denoLockFilePath` options to `DenoWorker` for the `--v8-flags`, `--import-map`, `--cached-only`, and `--lock` flags.
    -   Thanks to [@derekwheel](https://github.com/derekwheel) for contributing this! ([#12](https://github.com/casual-simulation/node-deno-vm/pull/12))

## v0.8.1

### Date: 8/12/2021

### Changes:

-   Updated to support Deno 1.12.
    -   Deno 1.12 added the `MessageChannel` and `MessagePort` APIs which caused `MessagePort` instances to be untransferrable.
-   Added the `denoUnstable` option to `DenoWorker` to enable unstable Deno features.

## v0.8.0

### Date: 9/17/2020

### Changes:

-   Updated to support Deno 1.4.
    -   Deno 1.4 changed their WebSocket API and so we no longer need the polyfill.

## v0.7.4

### Date: 9/10/2020

### Changes:

-   Fixed to force the Deno subprocess to close when terminating the worker.
    -   Forcing the process to be killed seems to be the most reasonable in the case that we're treating these like headless browser tabs.
    -   When we try to gracefully kill the process, Deno might ignore it if it has things like infinite loops or open handles.
    -   On Linux/Unix, this means sending a `SIGKILL` signal to the Deno subprocess.
    -   On Windows, this means using `taskkill` with the `/T` and `/F` options.

## v0.7.3

### Date: 8/28/2020

### Changes:

-   Fixed to use the global `Object.hasOwnProperty()` function instead of relying on objects to have it themselves.

## v0.7.1

### Date: 7/27/2020

### Changes:

-   Fixed to log stdout and stderr in UTF-8.

## v0.7.0

### Date: 7/27/2020

### Changes:

-   Added the ability to get the stdout and stderr streams from the worker and choose whether to automatically log them to the console.
-   Added a global WebSocket polyfill since Deno doesn't implement the [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).

## v0.7.0-alpha.1

### Date: 7/27/2020

### Changes:

-   Fixed the WebSocket implementation to allow setting `binaryType`.

## v0.7.0-alpha.0

### Date: 7/27/2020

### Changes:

-   Added a global WebSocket polyfill since Deno doesn't implement the [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).

## v0.6.2

### Date: 7/23/2020

### Changes:

-   Exported MessageChannel and MessagePort.
-   Added `polyfillMessageChannel()` to polyfill the MessageChannel and MessagePort objects on the global object.

## v0.6.1

### Date: 7/22/2020

### Changes:

-   Fixed an issue where permissions were being passed incorrectly.

## v0.6.0

### Date: 7/22/2020

### Changes:

-   Added the ability to transfer `MessagePort` instances between the host and worker.

## v0.5.0

### Date: 7/21/2020

### Changes:

-   Added the `DenoWorker` class.
    -   It is a Web Worker-like API that gives you the ability to run arbitrary scripts inside Deno.
    -   Supports the structure-clone algorithm for Maps, Sets, BigInts, ArrayBuffers, Errors, and circular object references.
    -   Requires that Deno be installed on the system.
