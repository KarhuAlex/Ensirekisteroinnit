import type { PxVariable } from './client.js';
import { FUEL_CODE_MAP, FUEL_TOTAL_CODE } from './mapping.js';

export const VAR_AREA = 'Alue';
export const VAR_MODEL = 'Mallisarja';
export const VAR_FUEL = 'Käyttövoima';
export const VAR_MONTH = 'Kuukausi';

export function requireVariable(variables: PxVariable[], code: string): PxVariable {
  const variable = variables.find((v) => v.code === code);
  if (!variable) throw new Error(`Table has no variable "${code}" - source schema changed?`);
  return variable;
}

/** Unknown fuel codes fail the run on purpose, so a new fuel class is never silently dropped. */
export function assertKnownFuels(fuels: PxVariable): void {
  const unknown = fuels.values.filter((c) => c !== FUEL_TOTAL_CODE && !(c in FUEL_CODE_MAP));
  if (unknown.length > 0) throw new Error(`Unmapped fuel codes in source: ${unknown.join(', ')}`);
}
