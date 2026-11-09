#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { TraficomPxWebAdapter } from './adapters/traficom-pxweb/adapter.js';
import { runIngest } from './pipeline/run.js';
import { FsStore } from './storage/fs-store.js';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: '.data' },
    force: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(`Usage: regs-ingest [--out <dir>] [--force]

Fetches the latest data and writes a release to <dir>/published (raw responses go to <dir>/raw).
  --out    Output directory (default: .data)
  --force  Publish a new release even if the source has not changed`);
  process.exit(0);
}

const out = values.out ?? '.data';

try {
  const result = await runIngest({
    adapter: new TraficomPxWebAdapter(),
    rawStore: new FsStore(`${out}/raw`),
    publishedStore: new FsStore(`${out}/published`),
    force: values.force ?? false,
  });
  console.log(JSON.stringify(result));
} catch (err) {
  console.error(err);
  process.exit(1);
}
