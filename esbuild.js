/* eslint-disable @typescript-eslint/no-var-requires */
const { dirname: _dirname } = require('path')

async function start() {
    await require('esbuild').build({
        entryPoints: ['src/index.ts'],
        bundle: true,
        minify: process.env.NODE_ENV === 'production',
        sourcemap: process.env.NODE_ENV === 'development',
        mainFields: ['module', 'main'],
        external: ['coc.nvim'],
        platform: 'node',
        target: 'node10.12',
        outfile: 'build/index.js',
        plugins: [],
    })
}

start().catch((e) => {
    console.error(e)
})
