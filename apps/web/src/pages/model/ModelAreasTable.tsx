import { useI18n } from '../../i18n';
import type { EntityAreaRow, SmallAreaRow } from '../../lib/entityAreas';

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
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
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
              <td>{row.name}</td>
              <td className="num">{fmt.int(row.count)}</td>
              <td className="num">{fmt.pct(row.share)}</td>
              <td className="wrap">
                {row.standing ? t(`model.areas.standing.${row.standing}`) : '–'}
              </td>
            </tr>
          ))}
          {small.map((row) => (
            <tr key={row.id} className="muted">
              <td>{row.name}</td>
              <td className="num">{fmt.int(row.count)}</td>
              <td className="num">–</td>
              <td className="wrap">{t('model.areas.few')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
