import { FUEL_GROUP_IDS } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { nextFuels } from './fuelSelection';

describe('nextFuels', () => {
  it('narrows to the picked fuel while all are active', () => {
    expect(nextFuels([...FUEL_GROUP_IDS], 'bev')).toEqual(['bev']);
  });

  it('adds and removes further picks, keeping the canonical order', () => {
    expect(nextFuels(['diesel'], 'bev')).toEqual(['diesel', 'bev']);
    expect(nextFuels(['diesel', 'bev'], 'diesel')).toEqual(['bev']);
  });

  it('goes back to all fuels when the last one is removed', () => {
    expect(nextFuels(['bev'], 'bev')).toEqual([...FUEL_GROUP_IDS]);
  });
});
