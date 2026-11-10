import { SCHEMA_VERSION, type Dataset, type LatestPointer } from '@regs/core';
import type { RawFile, SourceAdapter } from '../adapters/types.js';
import { consoleLogger, type Logger } from '../logger.js';
import type { Notifier, PublishReason } from '../notify/types.js';
import type { ObjectStore } from '../storage/types.js';
import { describeError } from '../util/errors.js';
import type { Pipeline, PublishableRelease } from './pipeline.js';
import { registrationsPipeline } from './registrations.js';
import type { ValidationLimits } from './validate.js';

export const LATEST_POINTER_PATH = 'latest.json';

const JSON_TYPE = 'application/json; charset=utf-8';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const SHORT_LIVED = 'public, max-age=300';

export interface PipelineOptions {
  rawStore: ObjectStore;
  publishedStore: ObjectStore;
  logger?: Logger;
  notifier?: Notifier;
  /** Publish even if the source version is unchanged. */
  force?: boolean;
  now?: () => Date;
}

export interface IngestOptions extends PipelineOptions {
  adapter: SourceAdapter<Dataset>;
  limits?: ValidationLimits;
}

export type IngestResult =
  | { status: 'skipped'; sourceVersion: string }
  | { status: 'published'; sourceVersion: string; release: string; files: number };

export function runIngest(opts: IngestOptions): Promise<IngestResult> {
  return runPipeline(registrationsPipeline(opts.adapter, opts.limits), opts);
}

export async function runPipeline<T>(
  pipeline: Pipeline<T>,
  opts: PipelineOptions,
): Promise<IngestResult> {
  try {
    return await publishIfChanged(pipeline, opts);
  } catch (error) {
    const log = opts.logger ?? consoleLogger;
    await sendNotice(log, () =>
      opts.notifier?.failed({
        pipeline: pipeline.name,
        message: describeError(error),
        occurredAt: (opts.now ?? (() => new Date()))().toISOString(),
      }),
    );
    throw error;
  }
}

async function publishIfChanged<T>(
  pipeline: Pipeline<T>,
  opts: PipelineOptions,
): Promise<IngestResult> {
  const log = opts.logger ?? consoleLogger;
  const version = await pipeline.adapter.getVersion();
  const current = await readLatest(opts.publishedStore);
  const sourceChanged = current?.sourceVersion !== version;

  if (!opts.force && !sourceChanged && current?.format === pipeline.format) {
    log.info(`Source unchanged (${version}); nothing to do.`);
    return { status: 'skipped', sourceVersion: version };
  }
  log.info(`New source version ${version} (previous: ${current?.sourceVersion ?? 'none'}).`);

  const { dataset, rawFiles } = await pipeline.adapter.fetch();
  pipeline.validate(dataset);
  await archiveRaw(opts.rawStore, rawFiles);

  const release = pipeline.build(dataset, (opts.now ?? (() => new Date()))());
  const sourceVersion = pipeline.sourceVersionOf(dataset);
  await publishRelease(opts.publishedStore, release, sourceVersion, pipeline.format);
  log.info(`Published release ${release.id} (${release.files.length} files).`);

  await sendNotice(log, () =>
    opts.notifier?.published({
      pipeline: pipeline.name,
      reason: publishReason(opts.force ?? false, sourceChanged),
      release: release.id,
      sourceVersion,
      previousSourceVersion: current?.sourceVersion ?? null,
      files: release.files.length,
      generatedAt: release.generatedAt,
    }),
  );
  return { status: 'published', sourceVersion, release: release.id, files: release.files.length };
}

/** Raw data is archived first so a release can always be reproduced from what was fetched. */
async function archiveRaw(store: ObjectStore, files: readonly RawFile[]): Promise<void> {
  for (const file of files) await store.put(file.path, file.content);
}

/** The pointer is written last: readers see either the previous release or the complete new one. */
async function publishRelease(
  store: ObjectStore,
  release: PublishableRelease,
  sourceVersion: string,
  format: number,
): Promise<void> {
  for (const file of release.files) {
    await store.put(`${release.id}/${file.path}`, file.body, {
      contentType: JSON_TYPE,
      cacheControl: IMMUTABLE,
      compress: true,
    });
  }
  const pointer: LatestPointer = {
    schemaVersion: SCHEMA_VERSION,
    release: release.id,
    sourceVersion,
    generatedAt: release.generatedAt,
    format,
  };
  await store.put(LATEST_POINTER_PATH, JSON.stringify(pointer), {
    contentType: JSON_TYPE,
    cacheControl: SHORT_LIVED,
  });
}

function publishReason(force: boolean, sourceChanged: boolean): PublishReason {
  if (force) return 'forced';
  return sourceChanged ? 'new-source' : 'format-upgrade';
}

/** Sending a notification is best effort: a failure is logged and never changes the outcome of the run. */
async function sendNotice(log: Logger, send: () => Promise<void> | undefined): Promise<void> {
  try {
    await send();
  } catch (err) {
    log.warn('Could not send the notification.', err);
  }
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
