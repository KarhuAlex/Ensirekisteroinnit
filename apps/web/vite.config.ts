import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Connect, type Plugin } from 'vite';

const DATA_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../.data/published');

/**
 * Serves the output of `npm run ingest` at /data in dev and preview, so the app runs against real
 * data without cloud resources.
 */
function localData(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = (req.url ?? '').split('?')[0] ?? '';
    if (!url.startsWith('/data/')) return next();
    let relative: string;
    try {
      relative = decodeURIComponent(url.slice('/data/'.length));
    } catch {
      res.statusCode = 400;
      res.end('Bad request');
      return;
    }
    const file = resolve(join(DATA_DIR, normalize(relative)));
    if (!file.startsWith(DATA_DIR + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404;
      res.end('Not found. Run "npm run ingest" first.');
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    createReadStream(file).pipe(res);
  };
  return {
    name: 'local-data',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig({
  plugins: [react(), localData()],
  build: { chunkSizeWarningLimit: 1000 },
});
