import type { EntityKind, EntitySummary } from '@regs/core';
import { isComparable, levelOf, type EntityLevel } from './entityLevel';
import { COMPARE_METRICS, DEFAULT_METRIC, MAX_COMPARED, type CompareMetric } from './comparison';
import type { Lang } from './format';
import { RANGE_IDS, type RangeId } from './stats';

/** The compare page is a function of this, and all of it lives in the URL. */
export interface CompareState {
  items: string[];
  metric: CompareMetric;
  range: RangeId;
}

export interface ParsedCompare {
  state: CompareState;
  /** How many of the addresses' items were left out: unknown, repeated, too many or on another level. */
  dropped: number;
}

const DEFAULT_RANGE: RangeId = 'all';

const oneOf = <T extends string>(options: readonly T[], value: string | null, fallback: T): T =>
  options.find((option) => option === value) ?? fallback;

/**
 * Reads the state from the address. Everything compared is on the level of the first item that
 * exists, so an edited address cannot mix makes with models.
 */
export function parseCompare(
  params: URLSearchParams,
  kindOf: (id: string) => EntityKind | undefined,
): ParsedCompare {
  const wanted = (params.get('items') ?? '').split(',').filter(Boolean);
  let level: EntityLevel | null = null;
  const items: string[] = [];
  for (const id of wanted) {
    const kind = kindOf(id);
    const itemLevel = kind && isComparable(kind) ? levelOf(kind) : null;
    if (!itemLevel || items.includes(id) || items.length >= MAX_COMPARED) continue;
    level ??= itemLevel;
    if (itemLevel === level) items.push(id);
  }
  return {
    state: {
      items,
      metric: oneOf(COMPARE_METRICS, params.get('metric'), DEFAULT_METRIC),
      range: oneOf(RANGE_IDS, params.get('range'), DEFAULT_RANGE),
    },
    dropped: wanted.length - items.length,
  };
}

/** Defaults are left out so a plain comparison keeps a short address. */
export function toCompareParams(state: CompareState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.items.length > 0) params.set('items', state.items.join(','));
  if (state.metric !== DEFAULT_METRIC) params.set('metric', state.metric);
  if (state.range !== DEFAULT_RANGE) params.set('range', state.range);
  return params;
}

/** The compare page with the given items already chosen. */
export function comparePath(lang: Lang, items: readonly string[] = []): string {
  const query = toCompareParams({
    items: [...items],
    metric: DEFAULT_METRIC,
    range: DEFAULT_RANGE,
  }).toString();
  return `/${lang}/compare${query ? `?${query}` : ''}`;
}

/** What can still be added to a comparison: things on its level, and not yet in it. */
export function compareCandidates(
  entities: readonly EntitySummary[],
  chosen: readonly string[],
  level: EntityLevel | null,
): EntitySummary[] {
  return entities.filter((entity) => {
    const entityLevel = levelOf(entity.kind);
    return (
      entityLevel !== null &&
      !chosen.includes(entity.id) &&
      (level === null || entityLevel === level)
    );
  });
}
