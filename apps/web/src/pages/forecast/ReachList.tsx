import { useI18n } from '../../i18n';
import { MAX_HORIZON } from '../../lib/forecast';
import { reachOf, REACH_LEVELS, type Scenario } from '../../lib/forecastView';
import { MONTHS_PER_YEAR } from '../../lib/stats';

function ReachText({ scenario, level }: { scenario: Scenario; level: number }) {
  const { t, fmt } = useI18n();
  const reach = reachOf(scenario, level);
  const ceiling = Math.round(scenario.ceiling * 100);
  const years = MAX_HORIZON / MONTHS_PER_YEAR;
  if (reach.kind === 'none') return <>{t('forecast.reach.none', { level, years, ceiling })}</>;
  const earliest = fmt.month(reach.earliest);
  if (reach.latest === null) {
    return <>{t('forecast.reach.open', { level, years, ceiling, earliest })}</>;
  }
  return (
    <>{t('forecast.reach.window', { level, ceiling, earliest, latest: fmt.month(reach.latest) })}</>
  );
}

/** When the share could pass some levels, as sentences that name the saturation level they hold for. */
export function ReachList({ scenario }: { scenario: Scenario }) {
  const { t } = useI18n();
  return (
    <>
      <h3 className="panel-title">{t('forecast.reach.title')}</h3>
      <p className="muted">{t('forecast.reach.hint')}</p>
      <ul className="statement-list">
        {REACH_LEVELS.map((level) => (
          <li key={level}>
            <ReachText scenario={scenario} level={level} />
          </li>
        ))}
      </ul>
    </>
  );
}
