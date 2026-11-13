import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { SearchableTable } from '../../components/SearchableTable';
import { useI18n } from '../../i18n';
import { MIN_MUNICIPALITY_CARS } from '../../lib/fleet';
import type { FleetMakeAreaRow } from '../../lib/fleetMakes';
import { areaNameColumn } from './areaColumns';

interface Props {
  rows: FleetMakeAreaRow[];
  makeName: string;
  /** The id of the chosen area, whose row is marked. */
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** The areas with the cars of one make. A share in an area of too few cars is greyed and starred. */
export function FleetMakeAreaTable({ rows, makeName, selectedId, onSelect }: Props) {
  const { t, fmt } = useI18n();

  const columns = useMemo<ColumnDef<FleetMakeAreaRow>[]>(
    () => [
      areaNameColumn<FleetMakeAreaRow>(t('review.col.area'), selectedId, onSelect),
      {
        accessorKey: 'makeCars',
        header: t('fleet.col.makeCars'),
        cell: ({ row }) => fmt.int(row.original.makeCars),
        meta: { numeric: true },
        enableGlobalFilter: false,
        sortDescFirst: true,
      },
      {
        id: 'share',
        header: t('fleet.col.areaShare'),
        accessorFn: (row) => (row.reliable ? (row.share ?? undefined) : undefined),
        cell: ({ row }) =>
          row.original.reliable ? (
            fmt.pct(row.original.share)
          ) : (
            <span
              className="muted"
              title={t('fleet.col.unreliable', { min: fmt.int(MIN_MUNICIPALITY_CARS) })}
            >
              {fmt.pct(row.original.share)} *
            </span>
          ),
        meta: { numeric: true },
        enableGlobalFilter: false,
        sortDescFirst: true,
        sortUndefined: 'last',
      },
    ],
    [t, fmt, selectedId, onSelect],
  );

  return (
    <SearchableTable
      data={rows}
      columns={columns}
      caption={t('fleet.makeAreas.caption', { make: makeName })}
      defaultSort={[{ id: 'share', desc: true }]}
      isSelected={(row) => row.id === selectedId}
    />
  );
}
