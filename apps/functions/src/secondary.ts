import type { InvocationContext } from '@azure/functions';
import { runPipeline, type Logger } from '@regs/ingest';
import type { PipelineRuntime } from './config.js';

/** The part of the invocation context the ingest uses, so a test can pass a plain object. */
export type IngestContext = Pick<InvocationContext, 'log' | 'warn' | 'error'>;

export function contextLogger(context: IngestContext): Logger {
  return {
    info: (m, ...meta) => context.log(m, ...meta),
    warn: (m, ...meta) => context.warn(m, ...meta),
    error: (m, ...meta) => context.error(m, ...meta),
  };
}

/**
 * Runs a dataset that follows the main load. A failure is logged, not thrown: the pipeline has
 * already sent its failure notice, and the main run and the datasets after this one must go on.
 */
export async function ingestSecondary<T>(
  context: IngestContext,
  label: string,
  { pipeline, options }: PipelineRuntime<T>,
): Promise<void> {
  try {
    const result = await runPipeline(pipeline, { ...options, logger: contextLogger(context) });
    context.log(`${label} ingest finished`, result);
  } catch (err) {
    context.error(`${label} ingest failed`, err);
  }
}
