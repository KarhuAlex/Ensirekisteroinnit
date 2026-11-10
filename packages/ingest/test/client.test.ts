import { describe, expect, it } from 'vitest';
import { PxWebClient, PxWebHttpError } from '../src/adapters/pxweb/client.js';

type Reply = { status: number; body: string };

function clientReplying(replies: Reply[]) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(url);
    const reply = replies.shift() ?? { status: 500, body: 'no more replies' };
    return new Response(reply.body, { status: reply.status });
  }) as unknown as typeof fetch;
  const client = new PxWebClient({
    baseUrl: 'https://example.org/api/',
    fetchImpl,
    retryDelayMs: 0,
    maxRetries: 2,
  });
  return { client, calls };
}

describe('PxWebClient', () => {
  it('returns parsed JSON on success', async () => {
    const { client, calls } = clientReplying([{ status: 200, body: '[{"id":"a"}]' }]);
    await expect(client.listFolder('/db')).resolves.toEqual([{ id: 'a' }]);
    expect(calls).toEqual(['https://example.org/api/db']);
  });

  it('retries rate limiting and server errors', async () => {
    const { client, calls } = clientReplying([
      { status: 429, body: '' },
      { status: 503, body: '' },
      { status: 200, body: '[]' },
    ]);
    await expect(client.listFolder('db')).resolves.toEqual([]);
    expect(calls).toHaveLength(3);
  });

  it('does not retry client errors', async () => {
    const { client, calls } = clientReplying([{ status: 404, body: 'missing' }]);
    await expect(client.listFolder('db')).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(1);
  });

  it('gives up with the last error once retries are exhausted', async () => {
    const { client, calls } = clientReplying([
      { status: 500, body: '' },
      { status: 502, body: '' },
      { status: 503, body: '' },
    ]);
    const error = await client.listFolder('db').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PxWebHttpError);
    expect((error as PxWebHttpError).status).toBe(503);
    expect(calls).toHaveLength(3);
  });
});

describe('request timeout', () => {
  it('aborts a request that takes too long', async () => {
    const hanging: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    const client = new PxWebClient({
      baseUrl: 'https://example.org',
      fetchImpl: hanging,
      maxRetries: 0,
      timeoutMs: 20,
    });
    await expect(client.listFolder('x')).rejects.toBeDefined();
  });
});
