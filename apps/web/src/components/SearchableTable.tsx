import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { DataTable } from './DataTable';
import { TableToolbar } from './TableToolbar';

const PAGE_SIZE = 50;

interface Props<T> {
  data: T[];
  columns: ColumnDef<T>[];
  caption: string;
  defaultSort: SortingState;
  /** Extra controls next to the search field. */
  toolbar?: ReactNode;
  /** Shown instead of the table when nothing matches. */
  empty?: ReactNode;
}

/**
 * A table that is searched by name, sorted by its columns and shown a page at a time. A different
 * `data` array starts again from the first page, which is what a filter outside the table needs.
 */
export function SearchableTable<T>({
  data,
  columns,
  caption,
  defaultSort,
  toolbar,
  empty,
}: Props<T>) {
  const { t, fmt } = useI18n();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [sorting, setSorting] = useState<SortingState>(defaultSort);
  const [limitedFor, setLimitedFor] = useState(data);
  if (limitedFor !== data) {
    setLimitedFor(data);
    setLimit(PAGE_SIZE);
  }

  const table = useReactTable({
    data,
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
  const shown = table.getRowModel().rows.length;

  return (
    <>
      <TableToolbar
        searchLabel={t('models.filter')}
        query={query}
        onQueryChange={(value) => table.setGlobalFilter(value)}
        countText={t('models.count', { n: fmt.int(shown) })}
      >
        {toolbar}
      </TableToolbar>
      {shown === 0 && empty ? empty : <DataTable table={table} limit={limit} caption={caption} />}
      {shown > limit && (
        <button type="button" className="button" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
          {t('models.showMore')}
        </button>
      )}
    </>
  );
}
