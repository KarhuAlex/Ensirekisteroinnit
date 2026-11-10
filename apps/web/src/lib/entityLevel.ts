import type { EntityKind } from '@regs/core';

export type EntityLevel = 'model' | 'make';

/** Model series ('group' kind) count as models. */
export function inLevel(kind: EntityKind | undefined, level: EntityLevel): boolean {
  return level === 'make' ? kind === 'make' : kind === 'model' || kind === 'group';
}
