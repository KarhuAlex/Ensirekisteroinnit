import type { EntityKind, EntitySummary } from '@regs/core';
import { displayName } from './names';

export interface EntityOption {
  id: string;
  /** What the field shows and the user types. */
  name: string;
}

/**
 * The options of an entity picker. Two things can share a display name (a make and the corporate
 * group of the same name), so the kind is added to the names that repeat and every option stays
 * a unique thing to choose.
 */
export function entityOptions(
  entities: readonly EntitySummary[],
  kindLabel: (kind: EntityKind) => string,
): EntityOption[] {
  const names = entities.map((e) => displayName(e.label));
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return entities.map((e, i) => {
    const name = names[i] ?? e.label;
    return {
      id: e.id,
      name: (counts.get(name) ?? 0) > 1 ? `${name} (${kindLabel(e.kind)})` : name,
    };
  });
}
