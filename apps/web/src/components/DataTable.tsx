import { flexRender, type Header, type Table } from '@tanstack/react-table';
import { useState, type MouseEvent } from 'react';
import { useI18n } from '../i18n';
import { Icon } from './Icon';
import { TableFrame } from './TableFrame';

type Sorted = false | 'asc' | 'desc';

const SORTED_MESSAGE = { asc: 'table.sortedAsc', desc: 'table.sortedDesc' } as const;

/** Only the sorted column has `aria-sort`. */
const ariaSort = (sorted: Sorted): 'ascending' | 'descending' | undefined =>
  sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined;

function HeaderCell<T>({
  header,
  onSorted,
}: {
  header: Header<T, unknown>;
  onSorted: (column: string, sorted: Sorted) => void;
}) {
  const { column } = header;
  const sorted = column.getIsSorted();
  const numeric = column.columnDef.meta?.numeric;
  const label = flexRender(column.columnDef.header, header.getContext());
  // A click sorts by this column alone (shift-click multi-sort is off), so only one header ever
  // has `aria-sort` and the announcement describes the whole order.
  const sort = (event: MouseEvent<HTMLButtonElement>) => {
    const next = column.getNextSortingOrder();
    column.toggleSorting(undefined, false);
    onSorted(event.currentTarget.textContent?.trim() ?? '', next);
  };
  return (
    <th scope="col" aria-sort={ariaSort(sorted)} className={numeric ? 'num' : undefined}>
      {column.getCanSort() ? (
        <button type="button" className="th-button" onClick={sort}>
          {label}
          <Icon
            name={sorted === 'asc' ? 'sortAsc' : sorted === 'desc' ? 'sortDesc' : 'sortNone'}
            size={14}
            className={sorted ? 'sort-icon is-active' : 'sort-icon'}
          />
        </button>
      ) : (
        label
      )}
    </th>
  );
}

/** A TanStack table in a `TableFrame`; the first column holds the row headers. */
export function DataTable<T>({
  table,
  limit,
  caption,
  isSelected,
}: {
  table: Table<T>;
  limit?: number;
  caption: string;
  /** Marks the row of the chosen item. */
  isSelected?: (data: T) => boolean;
}) {
  const { t } = useI18n();
  // Each sort is announced through a status element that stays in the page.
  const [announcement, setAnnouncement] = useState('');
  const onSorted = (column: string, sorted: Sorted) =>
    setAnnouncement(sorted ? t(SORTED_MESSAGE[sorted], { column }) : t('table.unsorted'));

  const rows = table.getRowModel().rows;
  const visible = limit === undefined ? rows : rows.slice(0, limit);
  return (
    <>
      <TableFrame caption={caption}>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <HeaderCell key={header.id} header={header} onSorted={onSorted} />
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id} className={isSelected?.(row.original) ? 'is-selected' : undefined}>
              {row.getVisibleCells().map((cell, index) => {
                const Cell = index === 0 ? 'th' : 'td';
                return (
                  <Cell
                    key={cell.id}
                    scope={index === 0 ? 'row' : undefined}
                    className={cell.column.columnDef.meta?.numeric ? 'num' : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </TableFrame>
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </>
  );
}
