import { FUEL_GROUP_IDS, type FuelGroupId } from '@regs/core';

/** While all fuels are active, picking one narrows to it; later picks add or remove. */
export function nextFuels(current: readonly FuelGroupId[], picked: FuelGroupId): FuelGroupId[] {
  const all = current.length === FUEL_GROUP_IDS.length;
  const chosen = all
    ? [picked]
    : current.includes(picked)
      ? current.filter((g) => g !== picked)
      : [...current, picked];
  return chosen.length === 0
    ? [...FUEL_GROUP_IDS]
    : FUEL_GROUP_IDS.filter((g) => chosen.includes(g));
}
