import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
  type Timer,
} from '@azure/functions';
import { runIngest, type Logger } from '@regs/ingest';
import { getRuntime } from '../config.js';

function contextLogger(context: InvocationContext): Logger {
  return {
    info: (m, ...meta) => context.log(m, ...meta),
    warn: (m, ...meta) => context.warn(m, ...meta),
    error: (m, ...meta) => context.error(m, ...meta),
  };
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
