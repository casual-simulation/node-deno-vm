import typescript from 'rollup-plugin-typescript2';

export default [
    {
        input: './src/index.ts',
        output: [
            {
                dir: './dist/cjs',
                format: 'cjs',
                sourcemap: true,
            },
            {
                dir: './dist/esm',
                format: 'es',
                sourcemap: true,
            },
        ],
        plugins: [
            typescript({
                useTsconfigDeclarationDir: true,
            }),
        ],
        external: [
            'http',
            'ws',
            'child_process',
            'base64-js',
            'path',
            'process',
        ],
    },
];
