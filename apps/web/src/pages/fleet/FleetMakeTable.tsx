import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SearchableTable } from '../../components/SearchableTable';
import { useCatalog } from '../../data/DataProvider';
import { useI18n } from '../../i18n';
import type { FleetMakeRow } from '../../lib/fleet';

type NumericColumn = 'cars' | 'fleetShare' | 'bevShare' | 'meanAge';

/** The makes by cars in traffic. A make that also has a page in the registrations links to it. */
export function FleetMakeTable({ rows }: { rows: FleetMakeRow[] }) {
  const { lang, t, fmt } = useI18n();
  const { byId } = useCatalog();

  const columns = useMemo<ColumnDef<FleetMakeRow>[]>(() => {
    const numeric = (
      id: NumericColumn,
      header: string,
      text: (value: number | null) => string,
    ): ColumnDef<FleetMakeRow> => ({
      id,
      header,
      accessorFn: (row) => row[id] ?? undefined,
      cell: ({ row }) => text(row.original[id]),
      meta: { numeric: true },
      enableGlobalFilter: false,
      sortDescFirst: true,
      sortUndefined: 'last',
    });
    return [
      {
        accessorKey: 'name',
        header: t('models.col.make'),
        cell: ({ row }) =>
          byId.has(row.original.id) ? (
            <Link to={`/${lang}/models/${row.original.id}`}>{row.original.name}</Link>
          ) : (
            row.original.name
          ),
      },
      numeric('cars', t('fleet.col.cars'), (v) => fmt.int(v ?? 0)),
      numeric('fleetShare', t('fleet.col.fleetShare'), fmt.pct),
      numeric('bevShare', t('fleet.col.bevShare'), fmt.pct),
      numeric('meanAge', t('fleet.col.age'), (v) => (v === null ? '–' : fmt.decimal(v))),
    ];
  }, [t, fmt, lang, byId]);

  return (
    <SearchableTable
      data={rows}
      columns={columns}
      caption={t('fleet.makes.caption')}
      defaultSort={[{ id: 'cars', desc: true }]}
    />
  );
}
