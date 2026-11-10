import { RELEASE_FORMAT, USED_RELEASE_FORMAT, type Dataset } from '@regs/core';
import type { SourceAdapter } from '../adapters/types.js';
import type { Pipeline } from './pipeline.js';
import { CORPORATE_GROUPS } from '../config/corporate-groups.js';
import { reportCorporateGroups, withCorporateGroups } from './corporate-groups.js';
import { buildRelease } from './release.js';
import {
  DEFAULT_LIMITS,
  validateDataset,
  validateMakesAddUp,
  type ValidationLimits,
} from './validate.js';

/** Datasets of entities by fuel and month share one release layout, whatever the source. */
function releasePipeline(
  name: string,
  format: number,
  adapter: SourceAdapter,
  validate: Pipeline<Dataset>['validate'],
  build: Pipeline<Dataset>['build'] = buildRelease,
): Pipeline<Dataset> {
  return {
    name,
    format,
    adapter,
    validate,
    build,
    sourceVersionOf: (dataset) => dataset.sourceVersion,
  };
}

function validateRegistrations(limits: ValidationLimits): Pipeline<Dataset>['validate'] {
  return (dataset, log) => {
    validateDataset(dataset, limits);
    reportCorporateGroups(dataset, CORPORATE_GROUPS, log, limits.minGroupCoverage);
  };
}

const buildWithCorporateGroups: Pipeline<Dataset>['build'] = (dataset, now) =>
  buildRelease(withCorporateGroups(dataset, CORPORATE_GROUPS), now);

export function registrationsPipeline(
  adapter: SourceAdapter,
  limits: ValidationLimits = DEFAULT_LIMITS,
): Pipeline<Dataset> {
  return releasePipeline(
    'first registrations',
    RELEASE_FORMAT,
    adapter,
    validateRegistrations(limits),
    buildWithCorporateGroups,
  );
}

/**
 * There are far fewer entities and observations than in the registrations data. Used imports have
 * no corporate groups yet; the review shows them by make only.
 */
const USED_IMPORT_LIMITS: ValidationLimits = {
  minEntities: 50,
  minMonths: 60,
  minObservations: 2_000,
};

export function usedImportsPipeline(
  adapter: SourceAdapter,
  limits: ValidationLimits = USED_IMPORT_LIMITS,
): Pipeline<Dataset> {
  return releasePipeline('used imports', USED_RELEASE_FORMAT, adapter, (dataset) => {
    validateDataset(dataset, limits);
    validateMakesAddUp(dataset);
  });
}
