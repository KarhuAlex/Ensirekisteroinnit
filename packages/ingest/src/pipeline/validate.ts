import { TOTAL_ENTITY_ID, type Dataset } from '@regs/core';

export interface ValidationLimits {
  minEntities: number;
  minMonths: number;
  minObservations: number;
  /** Share (0 to 1) of the last 12 months that corporate groups must cover; unset skips it. */
  minGroupCoverage?: number;
}

export const DEFAULT_LIMITS: ValidationLimits = {
  minEntities: 100,
  minMonths: 60,
  minObservations: 10_000,
  minGroupCoverage: 0.97,
};

/**
 * Sanity checks before anything is published. A failed check aborts the run, so the previous
 * good release keeps being served instead of a broken one.
 */
export function validateDataset(dataset: Dataset, limits: ValidationLimits = DEFAULT_LIMITS): void {
  const problems: string[] = [];

  if (!dataset.entities.some((e) => e.kind === 'total' && e.id === TOTAL_ENTITY_ID)) {
    problems.push(`no "${TOTAL_ENTITY_ID}" entity`);
  }
  if (dataset.entities.length < limits.minEntities) {
    problems.push(`only ${dataset.entities.length} entities (expected ≥ ${limits.minEntities})`);
  }
  if (dataset.observations.length < limits.minObservations) {
    problems.push(
      `only ${dataset.observations.length} observations (expected ≥ ${limits.minObservations})`,
    );
  }

  const ids = new Set(dataset.entities.map((e) => e.id));
  if (ids.size !== dataset.entities.length) problems.push('duplicate entity ids');

  const periods = new Set(dataset.observations.map((o) => o.period));
  if (periods.size < limits.minMonths) {
    problems.push(`only ${periods.size} distinct months (expected ≥ ${limits.minMonths})`);
  }
  for (const o of dataset.observations) {
    if (!ids.has(o.entityId)) {
      problems.push(`observation refers to unknown entity "${o.entityId}"`);
      break;
    }
    if (!Number.isFinite(o.count) || o.count < 0) {
      problems.push(`invalid count ${o.count} for ${o.entityId} ${o.period}`);
      break;
    }
  }

  if (problems.length > 0) {
    throw new Error(`Dataset failed validation: ${problems.join('; ')}`);
  }
}

/** How far the makes may stray from the source's own all-cars row in any month. */
const MAKES_TOLERANCE = 0.005;

/**
 * For data known by make only: the makes must add up to the all-cars row. A source change that
 * drops or doubles makes would otherwise publish skewed shares without any warning.
 */
export function validateMakesAddUp(dataset: Dataset, tolerance = MAKES_TOLERANCE): void {
  const makeIds = new Set(dataset.entities.filter((e) => e.kind === 'make').map((e) => e.id));
  const byPeriod = new Map<string, { total: number; makes: number }>();
  for (const o of dataset.observations) {
    const isTotal = o.entityId === TOTAL_ENTITY_ID;
    if (!isTotal && !makeIds.has(o.entityId)) continue;
    const sums = byPeriod.get(o.period) ?? { total: 0, makes: 0 };
    if (isTotal) sums.total += o.count;
    else sums.makes += o.count;
    byPeriod.set(o.period, sums);
  }

  const off = [...byPeriod]
    .filter(([, { total, makes }]) => Math.abs(total - makes) > Math.max(1, total * tolerance))
    .map(([period, { total, makes }]) => `${period}: makes ${makes}, total ${total}`);
  if (off.length > 0) {
    throw new Error(
      `Makes do not add up to the total in ${off.length} months (${off.slice(0, 3).join('; ')})`,
    );
  }
}
