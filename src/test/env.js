self.onmessage = (e) => {
    if (e.data.type === 'env') {
        self.postMessage(Deno.env.get(e.data.name));
    }
};
