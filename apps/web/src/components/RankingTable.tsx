import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { downloadCsv } from '../lib/download';
import type { NamedRow } from '../lib/ranking';
import { rankingToCsv } from '../lib/rankingCsv';
import { ChangeCell } from './ChangeCell';
import { DataTable } from './DataTable';
import { FuelMix } from './FuelMix';
import { TableToolbar } from './TableToolbar';
import { useTableView } from './useTableView';

const PAGE_SIZE = 25;
/** A stable default, so the column definitions are not rebuilt on every render. */
const LINK_ALL = () => true;
const BY_COUNT = [{ id: 'count', desc: true }];

export function RankingTable({
  rows,
  showChange,
  caption,
  countHeader,
  period,
  isLinked = LINK_ALL,
}: {
  rows: NamedRow[];
  showChange: boolean;
  caption: string;
  countHeader: string;
  period: string;
  /** Which rows link to their page; a row without a page is plain text. */
  isLinked?: ((id: string) => boolean) | undefined;
}) {
  const { lang, t, fmt } = useI18n();

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
                {isLinked(r.id) ? <Link to={`/${lang}/models/${r.id}`}>{r.name}</Link> : r.name}
                {r.make && <span className="muted make">{r.make}</span>}
              </span>
            </span>
          );
        },
      },
      {
        ...numeric('count', countHeader, (c) => fmt.int(c.row.original.count)),
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
  }, [t, fmt, lang, showChange, countHeader, isLinked]);

  const {
    table,
    rows: shown,
    query,
    setQuery,
    limit,
    more,
    showMore,
  } = useTableView({ data: rows, columns, defaultSort: BY_COUNT, pageSize: PAGE_SIZE });

  return (
    <>
      <TableToolbar
        searchLabel={t('models.filter')}
        query={query}
        onQueryChange={setQuery}
        canDownload={shown.length > 0}
        onDownload={() =>
          downloadCsv(
            `first-registrations-${period}.csv`,
            rankingToCsv(
              shown.map((r) => r.original),
              period,
            ),
          )
        }
        countText={t('models.count', { n: fmt.int(shown.length) })}
      />
      <DataTable table={table} limit={limit} caption={caption} />
      {more && (
        <button type="button" className="button" onClick={showMore}>
          {t('models.showMore')}
        </button>
      )}
    </>
  );
}
