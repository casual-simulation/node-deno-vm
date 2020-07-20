import typescript from '@rollup/plugin-typescript';

export default {
    input: './index.ts',
    output: {
        dir: 'dist',
        format: 'cjs',
    },
    plugins: [typescript()],
};
