import { RELEASE_FORMAT, type Dataset } from '@regs/core';
import type { SourceAdapter } from '../adapters/types.js';
import type { Pipeline } from './pipeline.js';
import { buildRelease } from './release.js';
import { validateDataset, validateMakesAddUp, type ValidationLimits } from './validate.js';

/** Datasets of entities by fuel and month share one release layout, whatever the source. */
function releasePipeline(
  name: string,
  adapter: SourceAdapter,
  validate: (dataset: Dataset) => void,
): Pipeline<Dataset> {
  return {
    name,
    format: RELEASE_FORMAT,
    adapter,
    validate,
    build: buildRelease,
    sourceVersionOf: (dataset) => dataset.sourceVersion,
  };
}

export function registrationsPipeline(
  adapter: SourceAdapter,
  limits?: ValidationLimits,
): Pipeline<Dataset> {
  return releasePipeline('first registrations', adapter, (dataset) =>
    validateDataset(dataset, limits),
  );
}

/** There are far fewer entities and observations than in the registrations data. */
const USED_IMPORT_LIMITS: ValidationLimits = {
  minEntities: 50,
  minMonths: 60,
  minObservations: 2_000,
};

export function usedImportsPipeline(
  adapter: SourceAdapter,
  limits: ValidationLimits = USED_IMPORT_LIMITS,
): Pipeline<Dataset> {
  return releasePipeline('used imports', adapter, (dataset) => {
    validateDataset(dataset, limits);
    validateMakesAddUp(dataset);
  });
}
