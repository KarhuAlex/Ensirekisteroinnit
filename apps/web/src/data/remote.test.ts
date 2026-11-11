import { describe, expect, it } from 'vitest';
import { HttpError } from './api';
import { LOADING, stateOfLoad, loadRemote, once, oncePerKey } from './remote';

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

describe('stateOfLoad', () => {
  const load = async () => 1;
  const ready = { status: 'ready', data: 1 } as const;

  it('gives the state settled by the same load', () => {
    expect(stateOfLoad({ load, state: ready }, load)).toBe(ready);
  });

  it('reads a state settled by another load as loading, never as current', () => {
    expect(stateOfLoad({ load: async () => 2, state: ready }, load)).toBe(LOADING);
  });

  it('is loading before anything settles and while the load is held back', () => {
    expect(stateOfLoad(null, load)).toBe(LOADING);
    expect(stateOfLoad({ load, state: ready }, null)).toBe(LOADING);
  });
});

describe('oncePerKey', () => {
  it('names a request by its key, without parsing the arguments back out of it', async () => {
    const asked: [string, string][] = [];
    const load = oncePerKey(
      async (release: string, name: string) => {
        asked.push([release, name]);
        return `${release}:${name}`;
      },
      (release, name) => JSON.stringify([release, name]),
    );
    expect(await load('a/b', 'c')).toBe('a/b:c');
    expect(await load('a/b', 'c')).toBe('a/b:c');
    expect(asked).toEqual([['a/b', 'c']]);
  });

  it('shares one request per key', async () => {
    const calls: string[] = [];
    const load = oncePerKey(
      async (key: string) => {
        calls.push(key);
        return key.toUpperCase();
      },
      (key) => key,
    );
    expect(await Promise.all([load('a'), load('a'), load('b')])).toEqual(['A', 'A', 'B']);
    expect(calls).toEqual(['a', 'b']);
  });

  it('forgets a failure so the next call for that key tries again', async () => {
    let calls = 0;
    const load = oncePerKey(
      async (_key: string) => {
        calls++;
        if (calls === 1) throw new Error('first attempt fails');
        return calls;
      },
      (key) => key,
    );
    await expect(load('a')).rejects.toThrow();
    expect(await load('a')).toBe(2);
  });
});
