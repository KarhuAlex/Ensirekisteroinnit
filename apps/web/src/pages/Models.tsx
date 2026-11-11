import type { EntityKind } from '@regs/core';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchableTable } from '../components/SearchableTable';
import { ShareValue } from '../components/ShareValue';
import { PageHeader, Segmented, StatusPanel, usePageTitle } from '../components/ui';
import { useCatalog } from '../data/DataProvider';
import { useHasCorporateGroups } from '../data/useHasCorporateGroups';
import { useI18n } from '../i18n';
import { inList, type ListFilter } from '../lib/entityLevel';
import { entityPath } from '../lib/entityPath';
import { displayName } from '../lib/names';
import { percent } from '../lib/stats';

interface Row {
  id: string;
  name: string;
  kind: EntityKind;
  make: string;
  last12: number;
  total: number;
  bevShare: number | null;
}

export function Models() {
  const { lang, t, fmt } = useI18n();
  const { entities, byId } = useCatalog();
  const hasGroups = useHasCorporateGroups();
  const [filter, setFilter] = useState<ListFilter>('all');
  usePageTitle(`${t('models.title')} – ${t('app.title')}`);

  const data = useMemo<Row[]>(
    () =>
      entities
        .filter((e) => inList(e.kind, filter))
        .map((e) => ({
          id: e.id,
          name: displayName(e.label),
          kind: e.kind,
          make: e.makeId ? displayName(byId.get(e.makeId)?.label ?? '') : '',
          last12: e.last12,
          total: e.total,
          bevShare: percent(e.bevLast12, e.last12),
        })),
    [entities, byId, filter],
  );

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('models.col.name'),
        cell: (c) => {
          const { kind, id, name } = c.row.original;
          return <Link to={entityPath(lang, kind, id)}>{name}</Link>;
        },
      },
      {
        accessorKey: 'kind',
        header: t('models.col.type'),
        cell: (c) => <span className="plate">{t(`kind.${c.row.original.kind}`)}</span>,
        enableGlobalFilter: false,
      },
      { accessorKey: 'make', header: t('models.col.make') },
      {
        accessorKey: 'last12',
        header: t('models.col.last12'),
        meta: { numeric: true },
        cell: (c) => fmt.int(c.row.original.last12),
        enableGlobalFilter: false,
        sortDescFirst: true,
      },
      {
        accessorKey: 'total',
        header: t('models.col.total'),
        meta: { numeric: true },
        cell: (c) => fmt.int(c.row.original.total),
        enableGlobalFilter: false,
        sortDescFirst: true,
      },
      {
        id: 'bevShare',
        accessorFn: (r) => r.bevShare ?? undefined,
        header: t('models.col.bevShare'),
        meta: { numeric: true },
        cell: (c) => <ShareValue share={c.row.original.bevShare} />,
        enableGlobalFilter: false,
        sortUndefined: 'last',
        sortDescFirst: true,
      },
    ],
    [t, fmt, lang],
  );

  return (
    <>
      <PageHeader title={t('models.title')} lede={t('models.subtitle')} />
      <SearchableTable
        data={data}
        columns={columns}
        caption={t(filter === 'corporategroup' ? 'models.captionGroups' : 'models.caption')}
        defaultSort={[{ id: 'last12', desc: true }]}
        empty={<StatusPanel title={t('models.empty')} hint={t('search.emptyHint')} />}
        toolbar={
          <Segmented
            label={t('models.col.type')}
            value={filter}
            options={[
              { value: 'all', label: t('models.filterAll') },
              { value: 'make', label: t('models.filterMakes') },
              { value: 'model', label: t('models.filterModels') },
              ...(hasGroups
                ? [{ value: 'corporategroup' as const, label: t('models.filterGroups') }]
                : []),
            ]}
            onChange={setFilter}
          />
        }
      />
    </>
  );
}
