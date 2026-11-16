import type { ColumnDef, SortingState } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { DataTable } from './DataTable';
import { TableToolbar } from './TableToolbar';
import { useTableView } from './useTableView';

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
  /** Marks the row of the chosen item. */
  isSelected?: (data: T) => boolean;
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
  isSelected,
}: Props<T>) {
  const { t, fmt } = useI18n();
  const { table, rows, query, setQuery, limit, more, showMore } = useTableView({
    data,
    columns,
    defaultSort,
    pageSize: PAGE_SIZE,
  });
  const shown = rows.length;

  return (
    <>
      <TableToolbar
        searchLabel={t('models.filter')}
        query={query}
        onQueryChange={setQuery}
        countText={t('models.count', { n: fmt.int(shown) })}
      >
        {toolbar}
      </TableToolbar>
      {shown === 0 && empty ? (
        empty
      ) : (
        <DataTable table={table} limit={limit} caption={caption} isSelected={isSelected} />
      )}
      {more && (
        <button type="button" className="button" onClick={showMore}>
          {t('models.showMore')}
        </button>
      )}
    </>
  );
}
