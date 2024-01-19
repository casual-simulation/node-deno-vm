self.onmessage = async (e) => {
    if (e.data.type === 'fetch') {
        // NOTE: Don't fetch within tests unless an error is expected
        await fetch(e.data.url).then(
            (r) => self.postMessage({ type: 'response', status: r.status }),
            (e) => self.postMessage({ type: 'error', error: e.message })
        );
    }
};
