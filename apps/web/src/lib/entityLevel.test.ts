import { describe, expect, it } from 'vitest';
import { inLevel } from './entityLevel';

describe('inLevel', () => {
  it('counts models and model series as models', () => {
    expect(inLevel('model', 'model')).toBe(true);
    expect(inLevel('group', 'model')).toBe(true);
    expect(inLevel('make', 'model')).toBe(false);
  });

  it('counts only makes as makes', () => {
    expect(inLevel('make', 'make')).toBe(true);
    expect(inLevel('model', 'make')).toBe(false);
    expect(inLevel('total', 'make')).toBe(false);
    expect(inLevel(undefined, 'model')).toBe(false);
  });
});
