self.onmessage = (event) => {
    let arrays = [];
    for (;;) {
        arrays.push(new Uint32Array(128));
        console.log(arrays.length);
    }
};
