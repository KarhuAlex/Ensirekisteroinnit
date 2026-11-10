import { RELEASE_FORMAT, type Dataset } from '@regs/core';
import type { SourceAdapter } from '../adapters/types.js';
import type { Pipeline } from './pipeline.js';
import { buildRelease } from './release.js';
import { validateDataset, type ValidationLimits } from './validate.js';

export function registrationsPipeline(
  adapter: SourceAdapter,
  limits?: ValidationLimits,
): Pipeline<Dataset> {
  return {
    name: 'first registrations',
    format: RELEASE_FORMAT,
    adapter,
    validate: (dataset) => validateDataset(dataset, limits),
    build: buildRelease,
    sourceVersionOf: (dataset) => dataset.sourceVersion,
  };
}
