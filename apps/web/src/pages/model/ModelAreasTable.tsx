import { useI18n } from '../../i18n';
import type { EntityAreaRow, SmallAreaRow } from '../../lib/entityAreas';
import { TableFrame } from '../../components/TableFrame';

interface Props {
  ranked: readonly EntityAreaRow[];
  /** Areas with too few registrations for a share, shown after the ranked ones. */
  small: readonly SmallAreaRow[];
}

/** The regions with their count, share and how the share compares with the country's. */
export function ModelAreasTable({ ranked, small }: Props) {
  const { t, fmt } = useI18n();
  const caption = t('model.areas.caption');
  return (
    <TableFrame caption={caption}>
      <thead>
        <tr>
          <th scope="col">{t('model.areas.col.region')}</th>
          <th scope="col" className="num">
            {t('model.areas.col.count')}
          </th>
          <th scope="col" className="num">
            {t('model.areas.col.share')}
          </th>
          <th scope="col" className="wrap">
            {t('model.areas.col.standing')}
          </th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((row) => (
          <tr key={row.id}>
            <th scope="row">{row.name}</th>
            <td className="num">{fmt.int(row.count)}</td>
            <td className="num">{fmt.pct(row.share)}</td>
            <td className="wrap">
              {row.standing ? t(`model.areas.standing.${row.standing}`) : '–'}
            </td>
          </tr>
        ))}
        {small.map((row) => (
          <tr key={row.id} className="muted">
            <th scope="row">{row.name}</th>
            <td className="num">{fmt.int(row.count)}</td>
            <td className="num">–</td>
            <td className="wrap">{t('model.areas.few')}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}
