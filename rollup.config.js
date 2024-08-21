import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import pkg from './package.json';

export default [
    {
        input: 'lib/index.js',
        output: {
            name: 'index',
            file: pkg.main,
            format: 'cjs',
            exports: 'named',
            sourcemap: false
        },
        external: ['debug', 'rfc2047'],
        plugins: [
            commonjs(),
            babel()
        ]
    }
];
