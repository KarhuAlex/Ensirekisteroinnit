import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { downloadCsv } from '../lib/download';
import { changeOf, type NamedRow } from '../lib/ranking';
import { rankingToCsv } from '../lib/rankingCsv';
import { DataTable } from './DataTable';
import { FuelMix } from './FuelMix';
import { Icon } from './Icon';

const PAGE_SIZE = 25;

function ChangeCell({ count, previous }: { count: number; previous: number | null }) {
  const { fmt } = useI18n();
  const change = changeOf(count, previous);
  if (!change) return <span className="muted">–</span>;
  const tone = change.delta > 0 ? 'pos' : change.delta < 0 ? 'neg' : 'flat';
  const text =
    change.percent !== null ? fmt.signedPct(change.percent) : fmt.signedInt(change.delta);
  return (
    <span className={`change change--${tone}`}>
      {change.delta !== 0 && <Icon name={change.delta > 0 ? 'arrowUp' : 'arrowDown'} size={14} />}
      {text}
    </span>
  );
}

export function RankingTable({
  rows,
  showChange,
  caption,
  period,
}: {
  rows: NamedRow[];
  showChange: boolean;
  caption: string;
  period: string;
}) {
  const { lang, t, fmt } = useI18n();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'count', desc: true }]);

  const columns = useMemo<ColumnDef<NamedRow>[]>(() => {
    const numeric = (id: string, header: string, cell: ColumnDef<NamedRow>['cell']) =>
      ({
        id,
        header,
        cell,
        meta: { numeric: true },
        enableGlobalFilter: false,
        sortDescFirst: true,
        sortUndefined: 'last',
      }) satisfies ColumnDef<NamedRow>;
    return [
      {
        id: 'name',
        accessorFn: (r) => `${r.name} ${r.make}`,
        header: t('models.col.name'),
        cell: (c) => {
          const r = c.row.original;
          return (
            <span className="rank-name">
              <span className="rank">{r.rank}</span>
              <span>
                <Link to={`/${lang}/models/${r.id}`}>{r.name}</Link>
                {r.make && <span className="muted make">{r.make}</span>}
              </span>
            </span>
          );
        },
      },
      {
        ...numeric('count', t('review.col.count'), (c) => fmt.int(c.row.original.count)),
        accessorFn: (r) => r.count,
      },
      {
        ...numeric('share', t('review.col.share'), (c) => fmt.pct(c.row.original.share)),
        accessorFn: (r) => r.share ?? undefined,
      },
      ...(showChange
        ? [
            {
              ...numeric('change', t('review.col.change'), (c) => (
                <ChangeCell count={c.row.original.count} previous={c.row.original.previous} />
              )),
              accessorFn: (r: NamedRow) => r.count - (r.previous ?? 0),
            },
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
  }, [t, fmt, lang, showChange]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: query },
    onSortingChange: setSorting,
    onGlobalFilterChange: (value: string) => {
      setQuery(value);
      setLimit(PAGE_SIZE);
    },
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const shown = table.getRowModel().rows;

  return (
    <>
      <div className="toolbar">
        <label className="field">
          <span>{t('models.filter')}</span>
          <span className="field-input">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={query}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
            />
          </span>
        </label>
        <button
          type="button"
          className="button"
          disabled={shown.length === 0}
          onClick={() =>
            downloadCsv(
              `first-registrations-${period}.csv`,
              rankingToCsv(
                shown.map((r) => r.original),
                period,
              ),
            )
          }
        >
          <Icon name="download" size={18} />
          {t('table.download')}
        </button>
        <span className="muted count" aria-live="polite">
          {t('models.count', { n: fmt.int(shown.length) })}
        </span>
      </div>
      <DataTable table={table} limit={limit} caption={caption} />
      {shown.length > limit && (
        <button type="button" className="button" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
          {t('models.showMore')}
        </button>
      )}
    </>
  );
}
