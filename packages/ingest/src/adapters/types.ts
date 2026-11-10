import type { Dataset } from '@regs/core';

export interface RawFile {
  path: string;
  content: string;
}

export interface AdapterResult<T = Dataset> {
  dataset: T;
  /** Unmodified source responses, archived so a release can be reproduced or reprocessed. */
  rawFiles: RawFile[];
}

/**
 * A source adapter is the only place that knows how a data provider works. To replace the source
 * (for example when Traficom retires its database), write a new adapter; the pipeline, the
 * published format and the web app stay as they are.
 */
export interface SourceAdapter<T = Dataset> {
  readonly id: string;
  /** Cheap check returning an opaque version string; equal versions mean "nothing new". */
  getVersion(): Promise<string>;
  fetch(): Promise<AdapterResult<T>>;
}
