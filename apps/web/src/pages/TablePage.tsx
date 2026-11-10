import { TOTAL_ENTITY_ID, type FuelGroupId } from '@regs/core';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { FuelMark } from '../components/FuelMark';
import { PeriodLink } from '../components/PeriodLink';
import { ShareValue } from '../components/ShareValue';
import { TableToolbar } from '../components/TableToolbar';
import { PageHeader, Segmented, Skeleton, StatusPanel, usePageTitle } from '../components/ui';
import { useCatalog, useEntitySeries } from '../data/DataProvider';
import { useI18n } from '../i18n';
import { downloadCsv } from '../lib/download';
import { buildPeriodRows, toCsv, type PeriodRow } from '../lib/periodRows';
import { buildSeriesView } from '../lib/seriesView';
import { STACK_ORDER } from '../lib/stats';

type Granularity = 'month' | 'year';

export function TablePage() {
  const { t, fmt } = useI18n();
  const { manifest } = useCatalog();
  const { series, error } = useEntitySeries(TOTAL_ENTITY_ID);
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'period', desc: true }]);
  usePageTitle(`${t('table.title')} – ${t('app.title')}`);

  const data = useMemo<PeriodRow[]>(() => {
    if (!series) return [];
    const { grouped, totals, annual } = buildSeriesView(series, manifest.months);
    return granularity === 'month'
      ? buildPeriodRows(manifest.months, grouped, totals)
      : buildPeriodRows(annual.years, annual.grouped, annual.totals);
  }, [series, manifest.months, granularity]);

  const columns = useMemo<ColumnDef<PeriodRow>[]>(() => {
    const fuel = (group: FuelGroupId): ColumnDef<PeriodRow> => ({
      accessorKey: group,
      header: () => (
        <span className="cell-mark">
          <FuelMark group={group} />
          {t(`fuel.group.${group}`)}
        </span>
      ),
      meta: { numeric: true },
      cell: (c) => fmt.int(c.row.original[group]),
      enableGlobalFilter: false,
      sortDescFirst: true,
    });
    const share = (key: 'bevShare' | 'plugShare', header: string): ColumnDef<PeriodRow> => ({
      id: key,
      accessorFn: (r) => r[key] ?? undefined,
      header,
      meta: { numeric: true },
      cell: (c) => <ShareValue share={c.row.original[key]} />,
      enableGlobalFilter: false,
      sortUndefined: 'last',
      sortDescFirst: true,
    });
    return [
      {
        accessorKey: 'period',
        header: t('table.period'),
        cell: (c) => (
          <PeriodLink period={c.row.original.period} monthly={granularity === 'month'} />
        ),
      },
      ...STACK_ORDER.map(fuel),
      {
        accessorKey: 'total',
        header: t('table.total'),
        meta: { numeric: true },
        cell: (c) => fmt.int(c.row.original.total),
        enableGlobalFilter: false,
        sortDescFirst: true,
      },
      share('bevShare', t('table.bevShare')),
      share('plugShare', t('table.plugShare')),
    ];
  }, [t, fmt, granularity]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: query },
    onSortingChange: setSorting,
    onGlobalFilterChange: setQuery,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rowCount = table.getRowModel().rows.length;

  return (
    <>
      <PageHeader title={t('table.title')} lede={t('table.subtitle')} />
      <TableToolbar
        searchLabel={t('table.search')}
        placeholder={t('table.searchPlaceholder')}
        query={query}
        onQueryChange={setQuery}
        canDownload={rowCount > 0}
        onDownload={() =>
          downloadCsv(
            `registrations-${granularity}.csv`,
            toCsv(table.getRowModel().rows.map((r) => r.original)),
          )
        }
        countText={t('table.rows', { n: fmt.int(rowCount) })}
      >
        <Segmented
          label={t('table.granularity')}
          value={granularity}
          options={[
            { value: 'month', label: t('chart.monthly') },
            { value: 'year', label: t('chart.yearly') },
          ]}
          onChange={setGranularity}
        />
      </TableToolbar>
      {error ? (
        <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />
      ) : !series ? (
        <Skeleton height={420} label={t('status.loading')} />
      ) : rowCount === 0 ? (
        <StatusPanel title={t('models.empty')} hint={t('search.emptyHint')} />
      ) : (
        <DataTable table={table} caption={t('table.caption')} />
      )}
    </>
  );
}
