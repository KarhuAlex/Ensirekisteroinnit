import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
  type Timer,
} from '@azure/functions';
import { runIngest, runPipeline, type Logger } from '@regs/ingest';
import { getRegionalRuntime, getRuntime, getUsedImportsRuntime } from '../config.js';

function contextLogger(context: InvocationContext): Logger {
  return {
    info: (m, ...meta) => context.log(m, ...meta),
    warn: (m, ...meta) => context.warn(m, ...meta),
    error: (m, ...meta) => context.error(m, ...meta),
  };
}

/** A failure is logged, not thrown: the pipeline has already sent its failure notice. */
async function ingestUsedImports(context: InvocationContext): Promise<void> {
  const { pipeline, options } = getUsedImportsRuntime();
  try {
    const result = await runPipeline(pipeline, { ...options, logger: contextLogger(context) });
    context.log('Used imports ingest finished', result);
  } catch (err) {
    context.error('Used imports ingest failed', err);
  }
}

/**
 * Checks for new source data on a schedule. The schedule is the INGEST_SCHEDULE app setting
 * (NCRONTAB, UTC), so changing it needs no deployment. When nothing has changed the run stops
 * after one metadata request.
 */
app.timer('ingestTimer', {
  schedule: '%INGEST_SCHEDULE%',
  runOnStartup: false,
  handler: async (_timer: Timer, context: InvocationContext): Promise<void> => {
    const result = await runIngest({ ...getRuntime(), logger: contextLogger(context) });
    context.log('Ingest finished', result);
    // A small table from the same source. It runs after the main load, not on a timer of its
    // own, so the source never gets both at the same moment.
    await ingestUsedImports(context);
  },
});

/**
 * The municipality-level data runs on the same schedule. A first run can outlast one invocation,
 * so progress is saved per area and the next run continues from there.
 */
app.timer('ingestRegionalTimer', {
  schedule: '%INGEST_SCHEDULE%',
  runOnStartup: false,
  handler: async (_timer: Timer, context: InvocationContext): Promise<void> => {
    const { pipeline, options } = getRegionalRuntime();
    const result = await runPipeline(pipeline, { ...options, logger: contextLogger(context) });
    context.log('Regional ingest finished', result);
  },
});

/** Manual trigger for the first data load: POST /api/ingest?force=true */
app.http('ingestManual', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'ingest',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const force = request.query.get('force') === 'true';
    try {
      const result = await runIngest({ ...getRuntime(), logger: contextLogger(context), force });
      return { status: 200, jsonBody: result };
    } catch (err) {
      context.error('Manual ingest failed', err);
      return { status: 500, jsonBody: { error: err instanceof Error ? err.message : String(err) } };
    }
  },
});
