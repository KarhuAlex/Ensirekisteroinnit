import { FUEL_GROUP_IDS, type Period } from '@regs/core';
import type { Remote } from '../data/remote';
import type { AreaQuery, AreaRanking, AreaRow, PeriodSpan } from './regionalRanking';

/** How many months the area picture of a make or model covers. */
export const ENTITY_AREA_MONTHS = 12;
/** A make or model with fewer registrations than this in the country has no area picture. */
export const MIN_ENTITY_COUNT = 20;
/** An area with fewer registrations of it is left out of the order, as its share moves by a car. */
export const MIN_AREA_COUNT = 5;

/**
 * The last year of a list of months, or all of them if there are fewer. Given the months of the
 * regional data this is the span that is shown; given the national months it names the years to fetch.
 */
export function lastYearSpan(months: readonly Period[]): PeriodSpan | null {
  const to = months.at(-1);
  const from = months[Math.max(0, months.length - ENTITY_AREA_MONTHS)];
  return to !== undefined && from !== undefined ? { from, to } : null;
}

/** All fuels of the make or model, over the span. */
export const entityAreaQuery = (entityId: string, period: PeriodSpan): AreaQuery => ({
  period,
  fuels: FUEL_GROUP_IDS,
  entityId,
  compare: null,
});

/** How an area's share compares with the national share. */
export type Standing = 'far-above' | 'above' | 'level' | 'below';

const FAR_ABOVE_INDEX = 150;
const ABOVE_INDEX = 120;
const LEVEL_INDEX = 80;

/** The index of a share, 100 being the national share, in words. */
export function standingOf(index: number | null): Standing | null {
  if (index === null) return null;
  if (index >= FAR_ABOVE_INDEX) return 'far-above';
  if (index >= ABOVE_INDEX) return 'above';
  return index >= LEVEL_INDEX ? 'level' : 'below';
}

/** One area, ranked by how large a share of its registrations the make or model is. */
export interface EntityAreaRow {
  id: string;
  name: string;
  /** Registrations of the make or model in the area. */
  count: number;
  /** Percent of all the registrations of the area. */
  share: number;
  standing: Standing | null;
}

/** An area with too few registrations of the make or model to say anything about its share. */
export interface SmallAreaRow {
  id: string;
  name: string;
  count: number;
}

export interface ReadyAreas {
  kind: 'ready';
  /** The country as a whole: the registrations of the make or model, and its share of all. */
  national: { count: number; share: number | null };
  /** The areas in order of the share, the highest first. */
  ranked: EntityAreaRow[];
  /** The other areas, the largest count first. */
  small: SmallAreaRow[];
}

/**
 * `too-few`: the country has under the limit. `thin`: it has enough, but no region has enough of
 * them for a share, so there is no order to show.
 */
export type EntityAreas = { kind: 'too-few' | 'thin'; count: number } | ReadyAreas;

const isPlace = (row: AreaRow): boolean => row.kind === 'region' || row.kind === 'municipality';

/** Enough registrations in the area, and in all there, for the share to mean something. */
const isRankable = (row: AreaRow): boolean => row.reliable && row.count >= MIN_AREA_COUNT;

const toRankedRow = (row: AreaRow): EntityAreaRow => ({
  id: row.id,
  name: row.name,
  count: row.count,
  share: row.share ?? 0,
  standing: standingOf(row.index),
});

const toSmallRow = (row: AreaRow): SmallAreaRow => ({
  id: row.id,
  name: row.name,
  count: row.count,
});

/**
 * The areas of a ranking made for one make or model. Registrations abroad or of no known place are
 * not an area. With too few registrations, or none that can be ranked, the result says so instead.
 */
export function entityAreas(ranking: AreaRanking): EntityAreas {
  const { national } = ranking;
  if (national.count < MIN_ENTITY_COUNT) return { kind: 'too-few', count: national.count };
  const places = ranking.rows.filter(isPlace);
  const ranked = places
    .filter(isRankable)
    .map(toRankedRow)
    .sort((a, b) => b.share - a.share || b.count - a.count);
  if (ranked.length === 0) return { kind: 'thin', count: national.count };
  const small = places
    .filter((row) => !isRankable(row))
    .map(toSmallRow)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    kind: 'ready',
    national: { count: national.count, share: national.share },
    ranked,
    small,
  };
}

/** How many areas are listed until the rest are asked for. */
export const TOP_AREAS = 5;

/** The areas to list: the top few, or all of them with the small ones at the end. */
export function listedAreas(
  areas: ReadyAreas,
  expanded: boolean,
): { ranked: EntityAreaRow[]; small: SmallAreaRow[]; canExpand: boolean } {
  return {
    ranked: expanded ? areas.ranked : areas.ranked.slice(0, TOP_AREAS),
    small: expanded ? areas.small : [],
    canExpand: areas.ranked.length > TOP_AREAS || areas.small.length > 0,
  };
}

/** Which part of the area section of a make or model is shown. */
export type AreasSectionState = 'hidden' | 'failed' | 'loading' | 'ready';

/**
 * Which part of the section to show. No regional data, or none of this make or model in it, means
 * no section at all. The map files ship with the site, so even a 404 for them is a failure.
 */
export function areasSectionState(
  regional: Remote<unknown>['status'],
  geo: Remote<unknown>['status'],
  covered: boolean,
): AreasSectionState {
  if (regional === 'unavailable') return 'hidden';
  if (regional === 'error' || geo === 'error' || geo === 'unavailable') return 'failed';
  if (regional === 'ready' && geo === 'ready') return covered ? 'ready' : 'hidden';
  return 'loading';
}
