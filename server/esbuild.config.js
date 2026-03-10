import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/main.js',
  external: ['oracledb', 'better-sqlite3'],
  format: 'esm',
  target: 'node20',
  sourcemap: true,
});

console.log('Build complete!');
