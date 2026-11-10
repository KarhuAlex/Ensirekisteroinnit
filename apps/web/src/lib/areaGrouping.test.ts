import type { Area } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { areaGroupOf } from './areaGrouping';

const mapping = {
  regionOfMunicipality: new Map([['049', '01']]),
  regionName: new Map([['01', 'Uusimaa']]),
};
const espoo: Area = { id: '049', name: 'Espoo', kind: 'municipality' };

describe('areaGroupOf', () => {
  it('keeps every area as it is when municipalities are wanted', () => {
    expect(areaGroupOf('municipality', mapping)(espoo)).toEqual({
      id: '049',
      name: 'Espoo',
      kind: 'municipality',
    });
  });

  it('puts a municipality in its region', () => {
    expect(areaGroupOf('region', mapping)(espoo)).toEqual({
      id: '01',
      name: 'Uusimaa',
      kind: 'region',
    });
  });

  it('leaves areas that are not municipalities alone', () => {
    const abroad: Area = { id: 'abroad', name: 'Ulkomaat', kind: 'abroad' };
    expect(areaGroupOf('region', mapping)(abroad).kind).toBe('abroad');
  });

  it('files a municipality that the boundaries do not know under unknown', () => {
    const stray: Area = { id: '999', name: 'Uusi kunta', kind: 'municipality' };
    expect(areaGroupOf('region', mapping)(stray)).toMatchObject({ id: 'unknown', kind: 'unknown' });
  });
});
