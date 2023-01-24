# Changelog

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
