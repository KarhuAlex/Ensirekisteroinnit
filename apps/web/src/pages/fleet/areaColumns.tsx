import type { ColumnDef } from '@tanstack/react-table';

/** The column of area names, each a button that chooses its area. */
export function areaNameColumn<T extends { id: string; name: string }>(
  header: string,
  selectedId: string | null,
  onSelect: (id: string) => void,
): ColumnDef<T> {
  return {
    accessorKey: 'name',
    header,
    cell: ({ row }) => (
      <button
        type="button"
        className="link-button"
        aria-pressed={row.original.id === selectedId}
        onClick={() => onSelect(row.original.id)}
      >
        {row.original.name}
      </button>
    ),
  };
}
