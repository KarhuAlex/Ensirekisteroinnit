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

/** A tab of the makes and models list: everything with a page, or one level. */
export type ListFilter = 'all' | EntityLevel;

/** `all` leaves corporate groups out; they are only shown on their own tab. */
export const inList = (kind: EntityKind, filter: ListFilter): boolean =>
  filter === 'all' ? isListed(kind) : inLevel(kind, filter);

/** The level a thing is compared at; model series count as models. The total is not compared. */
export function levelOf(kind: EntityKind): EntityLevel | null {
  switch (kind) {
    case 'make':
      return 'make';
    case 'corporategroup':
      return 'corporategroup';
    case 'model':
    case 'group':
      return 'model';
    case 'total':
      return null;
  }
}

export const isComparable = (kind: EntityKind): boolean => levelOf(kind) !== null;
