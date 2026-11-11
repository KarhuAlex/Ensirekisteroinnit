import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
  type Timer,
} from '@azure/functions';
import { runIngest, runPipeline } from '@regs/ingest';
import {
  getPricesRuntime,
  getRegionalRuntime,
  getFleetRuntime,
  getRuntime,
  getStockRuntime,
  getUsedImportsRuntime,
} from '../config.js';
import { contextLogger, ingestSecondary } from '../secondary.js';

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
    // Small tables, run one after another after the main load rather than on timers of their
    // own, so the sources never get several requests at the same moment.
    await ingestSecondary(context, 'Used imports', getUsedImportsRuntime());
    await ingestSecondary(context, 'Fuel prices', getPricesRuntime());
    await ingestSecondary(context, 'Car stock', getStockRuntime());
    await ingestSecondary(context, 'Car fleet', getFleetRuntime());
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
