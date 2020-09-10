self.postMessage('test');

self.onmessage = (e) => {
    while (true) {
        console.log('Running...');
    }
};
