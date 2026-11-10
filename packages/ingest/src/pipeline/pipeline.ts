import type { SourceAdapter } from '../adapters/types.js';
import type { ReleaseFile } from './release.js';

export interface PublishableRelease {
  id: string;
  generatedAt: string;
  files: ReleaseFile[];
}

/**
 * Everything that differs between published datasets. The run itself (version check, archive,
 * immutable release folder, pointer written last, notification) is the same for all of them.
 */
export interface Pipeline<T> {
  name: string;
  /** Bumped when the pipeline's release gains or changes files, which forces a rebuild. */
  format: number;
  adapter: SourceAdapter<T>;
  validate(data: T): void;
  build(data: T, now: Date): PublishableRelease;
  sourceVersionOf(data: T): string;
}
