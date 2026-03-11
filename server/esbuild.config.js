import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/main.js',
  external: ['oracledb', 'better-sqlite3', 'sql.js', 'node:*', 'pino/*', 'thread-stream'],
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
});

console.log('Build complete!');
