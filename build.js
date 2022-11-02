import { build } from 'esbuild'

try {
  await build({
      entryPoints: ['./src/index.ts'],
      bundle: true,
      outdir: './dist/',
      sourcemap: true,
      minify: true
    })
} catch(err) {
  process.exitCode = 1;
}

