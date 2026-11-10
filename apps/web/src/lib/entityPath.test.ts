import { describe, expect, it } from 'vitest';
import { entityPath } from './entityPath';

describe('entityPath', () => {
  it('links makes and models to their page', () => {
    expect(entityPath('fi', 'make', 'audi')).toBe('/fi/models/audi');
    expect(entityPath('en', 'model', 'audi-a4')).toBe('/en/models/audi-a4');
  });

  it('links a corporate group, which has no page, to the comparison', () => {
    expect(entityPath('fi', 'corporategroup', 'cg-vag')).toBe('/fi/compare?items=cg-vag');
  });
});
