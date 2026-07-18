const esbuild = require('esbuild');
const watch = process.argv.includes('--watch');

const ctx = esbuild.context({
  entryPoints: ['src/extension.ts', 'src/uninstall.ts'],
  bundle: true,
  outdir: 'dist',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
  minify: false,
});

ctx.then(async (c) => {
  if (watch) {
    await c.watch();
    console.log('Watching extension...');
  } else {
    await c.rebuild();
    await c.dispose();
    console.log('Extension built.');
  }
});
