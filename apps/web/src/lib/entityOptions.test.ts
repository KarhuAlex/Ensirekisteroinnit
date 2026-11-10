import type { EntitySummary } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { entityOptions } from './entityOptions';

const entity = (id: string, label: string, kind: EntitySummary['kind']): EntitySummary => ({
  id,
  label,
  kind,
  total: 1,
  last12: 1,
  bevLast12: 0,
});
const kindLabel = (kind: string) => (kind === 'make' ? 'Merkki' : 'Konserni');

describe('entityOptions', () => {
  it('uses the plain name when it is unique', () => {
    const options = entityOptions([entity('audi', 'Audi', 'make')], kindLabel);
    expect(options).toEqual([{ id: 'audi', name: 'Audi' }]);
  });

  it('adds the kind to names that repeat, so each option is a thing of its own', () => {
    const options = entityOptions(
      [
        entity('ford', 'Ford', 'make'),
        entity('cg-ford', 'Ford', 'corporategroup'),
        entity('audi', 'Audi', 'make'),
      ],
      kindLabel,
    );
    expect(options.map((o) => o.name)).toEqual(['Ford (Merkki)', 'Ford (Konserni)', 'Audi']);
    expect(new Set(options.map((o) => o.name)).size).toBe(3);
  });
});
