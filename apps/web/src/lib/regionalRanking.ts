import {
  FUEL_GROUP_IDS,
  TOTAL_ENTITY_ID,
  type Area,
  type AreaKind,
  type FuelGroupId,
  type Period,
  type RegionalIndex,
  type RegionalYear,
} from '@regs/core';

/** Below this many registrations in an area a share says little, so it is marked unreliable. */
export const MIN_AREA_BASE = 30;

export interface PeriodSpan {
  from: Period;
  to: Period;
}

export interface RegionalView {
  index: RegionalIndex;
  years: ReadonlyMap<string, RegionalYear>;
}

export interface AreaQuery {
  period: PeriodSpan;
  fuels: readonly FuelGroupId[];
  /** One model or make, or `null` for all cars. */
  entityId: string | null;
  compare: PeriodSpan | null;
}

/** Where an area ends up in the result: itself, or the region it belongs to. */
export interface AreaGroup {
  id: string;
  name: string;
  kind: AreaKind | 'region';
}

export interface AreaRow extends AreaGroup {
  count: number;
  /** All registrations in the area and period, whatever the fuel or entity. */
  total: number;
  /** Percent of the area's registrations that the numerator accounts for. */
  share: number | null;
  /** The share relative to the national share, 100 meaning the national level. */
  index: number | null;
  previousCount: number | null;
  previousShare: number | null;
  /** Change of the share in percentage points. */
  shareChange: number | null;
  /** The entity's registrations by fuel group, whatever the fuel filter. */
  mix: Record<FuelGroupId, number>;
  reliable: boolean;
}

export interface AreaRanking {
  rows: AreaRow[];
  national: AreaRow;
}

interface Tally {
  count: number;
  total: number;
  previousCount: number;
  previousTotal: number;
  mix: Record<FuelGroupId, number>;
}

const emptyMix = (): Record<FuelGroupId, number> =>
  Object.fromEntries(FUEL_GROUP_IDS.map((g) => [g, 0])) as Record<FuelGroupId, number>;

const emptyTally = (): Tally => ({
  count: 0,
  total: 0,
  previousCount: 0,
  previousTotal: 0,
  mix: emptyMix(),
});

const within = (period: Period, span: PeriodSpan | null): boolean =>
  span !== null && period >= span.from && period <= span.to;

const percent = (part: number, whole: number): number | null =>
  whole > 0 ? (part / whole) * 100 : null;

/** What one cell of the data contributes, reused for every cell so the hot loop allocates nothing. */
interface Cell {
  isTotal: boolean;
  isEntity: boolean;
  inMain: boolean;
  selected: boolean;
  group: FuelGroupId;
  count: number;
}

function addCell(target: Tally, cell: Cell): void {
  if (cell.isTotal) {
    if (cell.inMain) target.total += cell.count;
    else target.previousTotal += cell.count;
  }
  if (!cell.isEntity) return;
  if (cell.inMain) {
    target.mix[cell.group] += cell.count;
    if (cell.selected) target.count += cell.count;
  } else if (cell.selected) {
    target.previousCount += cell.count;
  }
}

export function rankAreas(
  view: RegionalView,
  query: AreaQuery,
  groupOf: (area: Area) => AreaGroup,
): AreaRanking {
  const { groups, groupIdOfArea } = groupAreas(view.index.areas, groupOf);
  const tallies = new Map([...groups.keys()].map((id) => [id, emptyTally()]));
  const national = emptyTally();
  tallyCells(view, query, groupIdOfArea, tallies, national);
  return buildRanking(groups, tallies, national, query.compare !== null);
}

function groupAreas(areas: readonly Area[], groupOf: (area: Area) => AreaGroup) {
  const groups = new Map<string, AreaGroup>();
  const groupIdOfArea = areas.map((area) => {
    const group = groupOf(area);
    groups.set(group.id, group);
    return group.id;
  });
  return { groups, groupIdOfArea };
}

function tallyCells(
  view: RegionalView,
  query: AreaQuery,
  groupIdOfArea: readonly string[],
  tallies: ReadonlyMap<string, Tally>,
  national: Tally,
): void {
  const { index } = view;
  const totalIndex = index.entities.indexOf(TOTAL_ENTITY_ID);
  const entityIndex = query.entityId === null ? totalIndex : index.entities.indexOf(query.entityId);
  const fuelSelected = index.groups.map((g) => query.fuels.includes(g));
  const inMain = index.months.map((month) => within(month, query.period));
  const inCompare = index.months.map((month) => within(month, query.compare));
  const cell: Cell = {
    isTotal: false,
    isEntity: false,
    inMain: false,
    selected: false,
    group: 'other',
    count: 0,
  };

  for (const year of view.years.values()) {
    const { e, a, g, m, n } = year.cells;
    for (let i = 0; i < n.length; i++) {
      const month = m[i] as number;
      if (!inMain[month] && !inCompare[month]) continue;
      cell.isTotal = e[i] === totalIndex;
      cell.isEntity = e[i] === entityIndex;
      if (!cell.isTotal && !cell.isEntity) continue;
      cell.inMain = inMain[month] as boolean;
      cell.selected = fuelSelected[g[i] as number] as boolean;
      cell.group = index.groups[g[i] as number] as FuelGroupId;
      cell.count = n[i] as number;
      addCell(tallies.get(groupIdOfArea[a[i] as number] as string) as Tally, cell);
      addCell(national, cell);
    }
  }
}

function buildRanking(
  groups: ReadonlyMap<string, AreaGroup>,
  tallies: ReadonlyMap<string, Tally>,
  national: Tally,
  hasCompare: boolean,
): AreaRanking {
  const nationalShare = percent(national.count, national.total);
  const toRow = (group: AreaGroup, tally: Tally): AreaRow => {
    const share = percent(tally.count, tally.total);
    const previousShare = hasCompare ? percent(tally.previousCount, tally.previousTotal) : null;
    return {
      ...group,
      count: tally.count,
      total: tally.total,
      share,
      index: share !== null && nationalShare ? (share / nationalShare) * 100 : null,
      previousCount: hasCompare ? tally.previousCount : null,
      previousShare,
      shareChange: share !== null && previousShare !== null ? share - previousShare : null,
      mix: tally.mix,
      reliable: tally.total >= MIN_AREA_BASE,
    };
  };
  return {
    rows: [...groups.values()].map((group) => toRow(group, tallies.get(group.id) as Tally)),
    national: toRow({ id: 'national', name: '', kind: 'region' }, national),
  };
}
