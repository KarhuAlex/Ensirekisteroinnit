import { TOTAL_ENTITY_ID, type Dataset } from '@regs/core';

export interface ValidationLimits {
  minEntities: number;
  minMonths: number;
  minObservations: number;
}

export const DEFAULT_LIMITS: ValidationLimits = {
  minEntities: 100,
  minMonths: 60,
  minObservations: 10_000,
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
