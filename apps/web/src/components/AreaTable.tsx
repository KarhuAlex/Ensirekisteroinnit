import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { areaToCsv, type AreaCsvRow } from '../lib/areaCsv';
import { downloadCsv } from '../lib/download';
import type { AreaMetric } from '../lib/reviewState';
import { DataTable } from './DataTable';
import { FuelMix } from './FuelMix';
import { TableToolbar } from './TableToolbar';

const SORT_COLUMN: Record<AreaMetric, string> = {
  share: 'share',
  index: 'index',
  count: 'count',
  change: 'shareChange',
};

/** Counts are always meaningful; shares, indexes and changes are not for areas with few cars. */
const ALWAYS_SHOWN = new Set(['count', 'total']);
const isShown = (row: AreaTableRow, column: string): boolean =>
  row.reliable || ALWAYS_SHOWN.has(column);

export interface AreaTableRow extends AreaCsvRow {
  /** The name to show, translated for the areas that are not municipalities. */
  label: string;
}

export function AreaTable({
  rows,
  metric,
  showChange,
  showRegion,
  caption,
  period,
}: {
  rows: AreaTableRow[];
  metric: AreaMetric;
  showChange: boolean;
  showRegion: boolean;
  caption: string;
  period: string;
}) {
  const { t, fmt } = useI18n();
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: SORT_COLUMN[metric], desc: true }]);
  const [sortedFor, setSortedFor] = useState(metric);
  if (sortedFor !== metric) {
    setSortedFor(metric);
    setSorting([{ id: SORT_COLUMN[metric], desc: true }]);
  }

  const columns = useMemo<ColumnDef<AreaTableRow>[]>(() => {
    const numeric = (
      id: string,
      header: string,
      value: (r: AreaTableRow) => number | null,
      text: (r: AreaTableRow) => string,
    ): ColumnDef<AreaTableRow> => ({
      id,
      header,
      accessorFn: (r) => (isShown(r, id) ? (value(r) ?? undefined) : undefined),
      cell: (c) => {
        const r = c.row.original;
        return isShown(r, id) ? (
          text(r)
        ) : (
          <span className="muted" title={t('review.col.unreliable')}>
            {text(r)} *
          </span>
        );
      },
      meta: { numeric: true },
      enableGlobalFilter: false,
      sortDescFirst: true,
      sortUndefined: 'last',
    });
    return [
      {
        id: 'name',
        accessorFn: (r) => `${r.label} ${r.region}`,
        header: t('review.col.area'),
        cell: (c) => {
          const r = c.row.original;
          return (
            <span>
              {r.label}
              {showRegion && r.region && <span className="muted make">{r.region}</span>}
            </span>
          );
        },
      },
      numeric(
        'count',
        t('review.col.count'),
        (r) => r.count,
        (r) => fmt.int(r.count),
      ),
      numeric(
        'total',
        t('review.col.total'),
        (r) => r.total,
        (r) => fmt.int(r.total),
      ),
      numeric(
        'share',
        t('review.col.share'),
        (r) => r.share,
        (r) => fmt.pct(r.share),
      ),
      numeric(
        'index',
        t('review.col.index'),
        (r) => r.index,
        (r) => (r.index === null ? '–' : fmt.int(Math.round(r.index))),
      ),
      ...(showChange
        ? [
            numeric(
              'shareChange',
              t('review.col.shareChange'),
              (r) => r.shareChange,
              (r) => fmt.signed(r.shareChange, ` ${t('unit.pp')}`),
            ),
          ]
        : []),
      {
        id: 'mix',
        header: t('legend.title'),
        cell: (c) => <FuelMix mix={c.row.original.mix} />,
        enableSorting: false,
        enableGlobalFilter: false,
      },
    ];
  }, [t, fmt, showChange, showRegion]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: query },
    onSortingChange: setSorting,
    onGlobalFilterChange: setQuery,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  const shown = table.getRowModel().rows;

  return (
    <>
      <TableToolbar
        searchLabel={t('models.filter')}
        query={query}
        onQueryChange={setQuery}
        canDownload={shown.length > 0}
        onDownload={() =>
          downloadCsv(
            `first-registrations-areas-${period}.csv`,
            areaToCsv(
              shown.map((r) => r.original),
              period,
            ),
          )
        }
        countText={t('models.count', { n: fmt.int(shown.length) })}
      />
      <DataTable table={table} caption={caption} />
    </>
  );
}
