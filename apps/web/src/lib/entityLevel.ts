import type { EntityKind } from '@regs/core';

export type EntityLevel = 'model' | 'make' | 'corporategroup';

/** Model series ('group' kind) count as models. */
export function inLevel(kind: EntityKind | undefined, level: EntityLevel): boolean {
  switch (level) {
    case 'make':
      return kind === 'make';
    case 'corporategroup':
      return kind === 'corporategroup';
    case 'model':
      return kind === 'model' || kind === 'group';
  }
}

/** Corporate groups are only ranked in the review; they have no page of their own. */
export const hasPage = (kind: EntityKind): boolean => kind !== 'corporategroup';

/** What search, the makes and models list and the area picker offer: things with a page, not the total. */
export const isListed = (kind: EntityKind): boolean => hasPage(kind) && kind !== 'total';
