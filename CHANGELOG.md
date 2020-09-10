# Changelog

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
