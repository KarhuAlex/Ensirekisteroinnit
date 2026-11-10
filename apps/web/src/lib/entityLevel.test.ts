import { describe, expect, it } from 'vitest';
import { inLevel, inList, isComparable, levelOf } from './entityLevel';

describe('inList', () => {
  it('lists makes and models under all, but not groups or the total', () => {
    expect(inList('make', 'all')).toBe(true);
    expect(inList('model', 'all')).toBe(true);
    expect(inList('group', 'all')).toBe(true);
    expect(inList('corporategroup', 'all')).toBe(false);
    expect(inList('total', 'all')).toBe(false);
  });

  it('lists corporate groups only on their own tab', () => {
    expect(inList('corporategroup', 'corporategroup')).toBe(true);
    expect(inList('make', 'corporategroup')).toBe(false);
    expect(inList('total', 'corporategroup')).toBe(false);
  });
});

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

describe('levelOf', () => {
  it('names the level each kind is compared at, with model series as models', () => {
    expect(levelOf('make')).toBe('make');
    expect(levelOf('model')).toBe('model');
    expect(levelOf('group')).toBe('model');
    expect(levelOf('corporategroup')).toBe('corporategroup');
  });

  it('leaves the total out of comparisons', () => {
    expect(levelOf('total')).toBeNull();
    expect(isComparable('total')).toBe(false);
    expect(isComparable('make')).toBe(true);
  });
});
