import { describe, expect, it } from 'vitest';
import { positiveInteger } from '../src/util/args.js';
import { describeError } from '../src/util/errors.js';

describe('positiveInteger', () => {
  it('accepts whole numbers of one or more', () => {
    expect(positiveInteger('x', '4')).toBe(4);
  });

  it('rejects anything else with the option name in the message', () => {
    for (const bad of ['abc', '0', '-2', '1.5', '', undefined]) {
      expect(() => positiveInteger('concurrency', bad)).toThrow('--concurrency');
    }
  });
});

describe('describeError', () => {
  it('follows the chain of causes', () => {
    const error = new Error('Area KU049 failed', { cause: new Error('HTTP 500') });
    expect(describeError(error)).toBe('Area KU049 failed <- HTTP 500');
  });

  it('handles values that are not errors', () => {
    expect(describeError('plain text')).toBe('plain text');
  });
});
