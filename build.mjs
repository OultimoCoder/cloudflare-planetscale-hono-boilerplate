#!/usr/bin/env node
/* eslint-disable node/shebang */
import esbuild from 'esbuild'

try {
  esbuild
    .build({
      entryPoints: ['./src/index.mjs'],
      bundle: true,
      outdir: './dist/',
      sourcemap: true,
      minify: true
    })
} catch(err) {
  process.exit(1)
}

