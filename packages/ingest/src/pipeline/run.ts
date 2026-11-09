import { SCHEMA_VERSION, type LatestPointer } from '@regs/core';
import type { SourceAdapter } from '../adapters/types.js';
import { consoleLogger, type Logger } from '../logger.js';
import type { ObjectStore } from '../storage/types.js';
import { buildRelease } from './release.js';
import { validateDataset, type ValidationLimits } from './validate.js';

export const LATEST_POINTER_PATH = 'latest.json';

const IMMUTABLE = 'public, max-age=31536000, immutable';
const SHORT_LIVED = 'public, max-age=300';

export interface IngestOptions {
  adapter: SourceAdapter;
  rawStore: ObjectStore;
  publishedStore: ObjectStore;
  logger?: Logger;
  /** Publish even if the source version is unchanged. */
  force?: boolean;
  now?: () => Date;
  limits?: ValidationLimits;
}

export type IngestResult =
  | { status: 'skipped'; sourceVersion: string }
  | { status: 'published'; sourceVersion: string; release: string; files: number };

export async function runIngest(opts: IngestOptions): Promise<IngestResult> {
  const log = opts.logger ?? consoleLogger;
  const now = opts.now ?? (() => new Date());

  const version = await opts.adapter.getVersion();
  const current = await readLatest(opts.publishedStore);
  if (!opts.force && current?.sourceVersion === version) {
    log.info(`Source unchanged (${version}); nothing to do.`);
    return { status: 'skipped', sourceVersion: version };
  }
  log.info(`New source version ${version} (previous: ${current?.sourceVersion ?? 'none'}).`);

  const { dataset, rawFiles } = await opts.adapter.fetch();
  validateDataset(dataset, opts.limits);

  // Archive raw data first so a release can always be reproduced from what was actually fetched.
  for (const file of rawFiles) {
    await opts.rawStore.put(file.path, file.content);
  }

  const release = buildRelease(dataset, now());
  for (const file of release.files) {
    await opts.publishedStore.put(`${release.id}/${file.path}`, file.body, {
      contentType: 'application/json; charset=utf-8',
      cacheControl: IMMUTABLE,
    });
  }

  // The pointer is written last: readers either see the previous release or the complete new one.
  const pointer: LatestPointer = {
    schemaVersion: SCHEMA_VERSION,
    release: release.id,
    sourceVersion: dataset.sourceVersion,
    generatedAt: release.generatedAt,
  };
  await opts.publishedStore.put(LATEST_POINTER_PATH, JSON.stringify(pointer), {
    contentType: 'application/json; charset=utf-8',
    cacheControl: SHORT_LIVED,
  });

  log.info(`Published release ${release.id} (${release.files.length} files).`);
  return {
    status: 'published',
    sourceVersion: dataset.sourceVersion,
    release: release.id,
    files: release.files.length,
  };
}

async function readLatest(store: ObjectStore): Promise<LatestPointer | null> {
  const text = await store.get(LATEST_POINTER_PATH);
  if (!text) return null;
  try {
    return JSON.parse(text) as LatestPointer;
  } catch {
    return null;
  }
}
