module.exports = {
    preset: 'ts-jest',
    moduleFileExtensions: ['ts', 'tsx', 'js'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/deno/',
        '/temp/',
        '/lib/',
        '/dist/',
    ],
    watchPathIgnorePatterns: ['/node_modules/'],
};
