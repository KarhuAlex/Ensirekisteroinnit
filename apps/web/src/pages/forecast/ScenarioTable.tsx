import { useI18n } from '../../i18n';
import type { Scenario } from '../../lib/forecastView';
import { TableFrame } from '../../components/TableFrame';

/** The distances, in months, at which the scenario is given as numbers. */
const DISTANCES = [12, 24, 36] as const;

/** The scenario and its range in words and numbers, for those who do not read the chart. */
export function ScenarioTable({ scenario }: { scenario: Scenario }) {
  const { t, fmt } = useI18n();
  const caption = t('forecast.tableCaption');
  const { path, low, high } = scenario.forecast;
  return (
    <TableFrame caption={caption}>
      <thead>
        <tr>
          <th scope="col">{t('forecast.col.when')}</th>
          <th scope="col" className="num">
            {t('forecast.col.value')}
          </th>
          <th scope="col" className="num">
            {t('forecast.col.range')}
          </th>
        </tr>
      </thead>
      <tbody>
        {DISTANCES.map((months) => (
          <tr key={months}>
            <th scope="row">{fmt.month(scenario.futureMonths[months - 1] ?? '')}</th>
            <td className="num">{fmt.pct(path[months - 1] ?? null)}</td>
            <td className="num">
              {fmt.pct(low[months - 1] ?? null)} – {fmt.pct(high[months - 1] ?? null)}
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}
