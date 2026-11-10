import { describe, expect, it } from 'vitest';
import { HttpError } from './api';
import { loadRemote, once } from './remote';

describe('loadRemote', () => {
  it('returns the data when the load succeeds', async () => {
    expect(await loadRemote(async () => 7)).toEqual({ status: 'ready', data: 7 });
  });

  it('reports a file that is not published yet as unavailable', async () => {
    const missing = async () => {
      throw new HttpError(404, 'https://example.org/prices/latest.json');
    };
    expect(await loadRemote(missing)).toEqual({ status: 'unavailable' });
  });

  it('reports other failures as errors', async () => {
    const broken = async () => {
      throw new Error('network down');
    };
    expect((await loadRemote(broken)).status).toBe('error');
  });
});

describe('once', () => {
  it('shares one request between callers', async () => {
    let calls = 0;
    const load = once(async () => ++calls);
    expect(await Promise.all([load(), load()])).toEqual([1, 1]);
    expect(calls).toBe(1);
  });

  it('forgets a failure so the next call tries again', async () => {
    let calls = 0;
    const load = once(async () => {
      calls++;
      if (calls === 1) throw new Error('first attempt fails');
      return calls;
    });
    await expect(load()).rejects.toThrow();
    expect(await load()).toBe(2);
  });
});
