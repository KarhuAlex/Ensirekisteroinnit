import { ChangeCell } from '../../components/ChangeCell';
import { SeriesMark } from '../../components/SeriesMark';
import { useI18n } from '../../i18n';

export interface CompareRow {
  id: string;
  name: string;
  slot: number;
  last12: number;
  yearAgo: number | null;
  /** Percent of all new cars; `null` while there is no full year. */
  share: number | null;
  bevShare: number | null;
}

/** The last 12 months of each compared thing in one row. */
export function CompareTable({ rows }: { rows: CompareRow[] }) {
  const { t, fmt } = useI18n();
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={t('compare.tableCaption')}>
      <table className="data-table">
        <caption className="sr-only">{t('compare.tableCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('compare.col.name')}</th>
            <th scope="col">{t('compare.col.last12')}</th>
            <th scope="col">{t('compare.col.share')}</th>
            <th scope="col">{t('compare.col.change')}</th>
            <th scope="col">{t('compare.col.bev')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">
                <SeriesMark slot={row.slot} />
                {row.name}
              </th>
              <td className="num">{fmt.int(row.last12)}</td>
              <td className="num">{fmt.pct(row.share)}</td>
              <td className="num">
                {row.yearAgo === null && row.last12 > 0 ? (
                  <span className="muted">{t('compare.new')}</span>
                ) : (
                  <ChangeCell count={row.last12} previous={row.yearAgo} />
                )}
              </td>
              <td className="num">{fmt.pct(row.bevShare)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
