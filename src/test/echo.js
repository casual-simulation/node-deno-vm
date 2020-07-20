self.onmessage = (e) => {
    if (e.data.type === 'echo') {
        self.postMessage(e.data);
    }
};
