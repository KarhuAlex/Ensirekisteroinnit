import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { useReducer } from 'react';
import { hasMore, initTableView, isStale, tableViewReducer } from '../lib/tableView';

interface Options<T> {
  /** Keep the same array until the rows change: a new array starts again from the first page. */
  data: T[];
  columns: ColumnDef<T>[];
  /** Compared by value; a module-level constant is cheapest. Another order replaces the reader's. */
  defaultSort: SortingState;
  /** Rows per page; leave it out to show every row. */
  pageSize?: number;
}

/**
 * A TanStack table that is searched by its text columns, sorted by its headers and shown a page
 * at a time. The rules between the three live in `lib/tableView`.
 */
export function useTableView<T>({ data, columns, defaultSort, pageSize }: Options<T>) {
  const [state, dispatch] = useReducer(
    tableViewReducer,
    { rows: data, defaultSort, pageSize: pageSize ?? null },
    initTableView,
  );
  // Adjusting state while rendering, as React advises for state that follows props.
  if (isStale(state, data, defaultSort)) dispatch({ type: 'sync', rows: data, defaultSort });

  const setQuery = (query: Updater<string | undefined>) => dispatch({ type: 'search', query });
  const table = useReactTable({
    data,
    columns,
    state: { sorting: state.sorting, globalFilter: state.query },
    onSortingChange: (sorting) => dispatch({ type: 'sort', sorting }),
    onGlobalFilterChange: setQuery,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  // Every row that matches the search, in order; the page shows the first `limit` of them.
  const rows = table.getRowModel().rows;

  return {
    table,
    rows,
    query: state.query,
    setQuery,
    limit: state.paging?.shown,
    more: hasMore(state, rows.length),
    showMore: () => dispatch({ type: 'showMore' }),
  };
}
