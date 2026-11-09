import { flexRender, type Header, type Table } from '@tanstack/react-table';
import { Icon } from './Icon';

type Sorted = false | 'asc' | 'desc';

const ariaSort = (sorted: Sorted): 'ascending' | 'descending' | 'none' =>
  sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none';

function HeaderCell<T>({ header }: { header: Header<T, unknown> }) {
  const sorted = header.column.getIsSorted();
  const numeric = header.column.columnDef.meta?.numeric;
  const label = flexRender(header.column.columnDef.header, header.getContext());
  return (
    <th scope="col" aria-sort={ariaSort(sorted)} className={numeric ? 'num' : undefined}>
      {header.column.getCanSort() ? (
        <button
          type="button"
          className="th-button"
          onClick={header.column.getToggleSortingHandler()}
        >
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

export function DataTable<T>({
  table,
  limit,
  caption,
}: {
  table: Table<T>;
  limit?: number;
  caption: string;
}) {
  const rows = table.getRowModel().rows;
  const visible = limit === undefined ? rows : rows.slice(0, limit);
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <HeaderCell key={header.id} header={header} />
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cell.column.columnDef.meta?.numeric ? 'num' : undefined}
                  data-col={cell.column.id}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
