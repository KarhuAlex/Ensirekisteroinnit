// Builds a self-contained deployment package in apps/functions/.deploy: host.json, package.json
// and one bundled dist/functions/ingest.js, so no node_modules is needed.
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.deploy');

await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'dist', 'functions'), { recursive: true });

await build({
  entryPoints: [join(root, 'src', 'functions', 'ingest.ts')],
  outfile: join(out, 'dist', 'functions', 'ingest.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  // The Functions host provides this at runtime; it is not on npm.
  external: ['@azure/functions-core'],
  // Some CommonJS dependencies call require(), so the ESM bundle needs a definition of it.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});

await cp(join(root, 'host.json'), join(out, 'host.json'));
await writeFile(
  join(out, 'package.json'),
  JSON.stringify(
    {
      name: 'regs-functions',
      version: '0.1.0',
      private: true,
      type: 'module',
      main: 'dist/functions/*.js',
    },
    null,
    2,
  ),
);
console.log(`Deployment package written to ${out}`);
