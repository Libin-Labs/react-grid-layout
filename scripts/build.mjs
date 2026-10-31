import { copyFile, mkdir } from 'node:fs/promises';
import { build } from 'tsup';

await build({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  target: 'es2020',
  external: ['react'],
  minify: false,
  sourcemap: false,
  splitting: false,
});

await mkdir('dist', { recursive: true });
await copyFile('src/style.css', 'dist/style.css');
await copyFile('dist/index.d.ts', 'dist/index.d.cts');
