import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { SearchableTable } from '../../components/SearchableTable';
import { ShareValue } from '../../components/ShareValue';
import { useI18n } from '../../i18n';
import { MIN_MUNICIPALITY_CARS, type FleetAreaRow } from '../../lib/fleet';

interface Props {
  rows: FleetAreaRow[];
  /** The id of the chosen area, whose row is marked. */
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** The areas. A share of too few cars is greyed out and starred; a name chooses its area. */
export function FleetAreaTable({ rows, selectedId, onSelect }: Props) {
  const { t, fmt } = useI18n();

  const columns = useMemo<ColumnDef<FleetAreaRow>[]>(() => {
    const share = (id: 'bevShare' | 'plugShare', header: string): ColumnDef<FleetAreaRow> => ({
      id,
      header,
      accessorFn: (row) => (row.reliable ? (row[id] ?? undefined) : undefined),
      cell: ({ row }) =>
        row.original.reliable ? (
          <ShareValue share={row.original[id]} />
        ) : (
          <span
            className="muted"
            title={t('fleet.col.unreliable', { min: fmt.int(MIN_MUNICIPALITY_CARS) })}
          >
            {fmt.pct(row.original[id])} *
          </span>
        ),
      meta: { numeric: true },
      enableGlobalFilter: false,
      sortDescFirst: true,
      sortUndefined: 'last',
    });
    return [
      {
        accessorKey: 'name',
        header: t('review.col.area'),
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
      },
      {
        accessorKey: 'cars',
        header: t('fleet.col.cars'),
        cell: ({ row }) => fmt.int(row.original.cars),
        meta: { numeric: true },
        enableGlobalFilter: false,
        sortDescFirst: true,
      },
      share('bevShare', t('fleet.col.bevShare')),
      share('plugShare', t('fleet.col.plugShare')),
    ];
  }, [t, fmt, selectedId, onSelect]);

  return (
    <SearchableTable
      data={rows}
      columns={columns}
      caption={t('fleet.areas.caption')}
      defaultSort={[{ id: 'cars', desc: true }]}
      isSelected={(row) => row.id === selectedId}
    />
  );
}
