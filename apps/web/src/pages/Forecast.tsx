import { TOTAL_ENTITY_ID } from '@regs/core';
import { useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ForecastChart } from '../components/ForecastChart';
import { SourceNote } from '../components/SourceNote';
import {
  Loading,
  PageHeader,
  Section,
  Segmented,
  Skeleton,
  StatusPanel,
  usePageHead,
} from '../components/ui';
import { useCatalog, useEntitySeries } from '../data/DataProvider';
import { dataOf, hasFailed } from '../data/remote';
import { useI18n } from '../i18n';
import { BAND_MARGIN_PERCENT, CEILINGS, DEFAULT_MODEL, pastCoverage } from '../lib/forecast';
import {
  buildScenario,
  ceilingParam,
  parseCeiling,
  pastScenarios,
  shareHistory,
  type Scenario,
  type ShareHistory,
} from '../lib/forecastView';
import { buildSeriesView } from '../lib/seriesView';
import { MONTHS_PER_YEAR, rollingShare } from '../lib/stats';
import { ReachList } from './forecast/ReachList';
import { ScenarioTable } from './forecast/ScenarioTable';

/** How many months back the earlier scenarios are made from. */
const BACKTEST_ORIGINS = [36, 24, 12] as const;
/** The distance, in months, at which the band is tried on the past. */
const COVERAGE_DISTANCE = 12;

const percentOf = (ceiling: number): number => Math.round(ceiling * 100);

/** The headline of the page with whatever it has to show, which may be only a notice. */
function ForecastPage({ lede, children }: { lede?: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('forecast.title')} {...(lede ? { lede } : {})} />
      {children}
    </>
  );
}

/** The electric share of first registrations: what the next years could hold, as a scenario. */
export function Forecast() {
  const { t } = useI18n();
  const { manifest } = useCatalog();
  const [params, setParams] = useSearchParams();
  const ceiling = parseCeiling(params.get('ceiling'));
  const seriesState = useEntitySeries(TOTAL_ENTITY_ID);
  const series = dataOf(seriesState);
  usePageHead({ page: 'forecast' });

  const history = useMemo(() => {
    if (!series) return null;
    const { grouped, totals } = buildSeriesView(series, manifest.months);
    return shareHistory(manifest.months, rollingShare(grouped.bev, totals, MONTHS_PER_YEAR));
  }, [series, manifest.months]);
  const scenario = useMemo(
    () => (history ? buildScenario(history, ceiling) : null),
    [history, ceiling],
  );

  const chooseCeiling = (next: number) => {
    const value = ceilingParam(next);
    setParams(value ? { ceiling: value } : {}, { replace: true });
  };

  if (hasFailed(seriesState)) {
    return (
      <ForecastPage>
        <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />
      </ForecastPage>
    );
  }
  if (!history) {
    return (
      <ForecastPage>
        <Loading>
          <Skeleton height={420} />
        </Loading>
      </ForecastPage>
    );
  }
  if (!scenario) {
    return (
      <ForecastPage>
        <StatusPanel title={t('forecast.notEnough')} />
      </ForecastPage>
    );
  }
  return (
    <ForecastPage lede={t('forecast.lede')}>
      <ScenarioSection scenario={scenario} onCeiling={chooseCeiling} />
      <PastSection history={history} ceiling={ceiling} />
      <MethodSection />
    </ForecastPage>
  );
}

function ScenarioSection({
  scenario,
  onCeiling,
}: {
  scenario: Scenario;
  onCeiling: (ceiling: number) => void;
}) {
  const { t } = useI18n();
  return (
    <Section
      id="forecast-chart"
      title={t('forecast.chartTitle')}
      tools={
        <Segmented
          label={t('forecast.ceiling')}
          value={String(percentOf(scenario.ceiling))}
          options={CEILINGS.map((c) => ({
            value: String(percentOf(c)),
            label: `${percentOf(c)} %`,
          }))}
          onChange={(value) => onCeiling(parseCeiling(value))}
        />
      }
      footnote={<SourceNote />}
    >
      <ForecastChart
        history={scenario.history}
        scenario={scenario}
        height={380}
        ariaLabel={t('forecast.aria')}
      />
      <ScenarioTable scenario={scenario} />
      <ReachList scenario={scenario} />
    </Section>
  );
}

/** Earlier scenarios beside what came to be, and how often the band has held. */
function PastSection({ history, ceiling }: { history: ShareHistory; ceiling: number }) {
  const { t } = useI18n();
  const past = useMemo(() => pastScenarios(history, BACKTEST_ORIGINS, ceiling), [history, ceiling]);
  const coverage = useMemo(
    () => pastCoverage(history.shares, COVERAGE_DISTANCE, { ...DEFAULT_MODEL, ceiling }),
    [history, ceiling],
  );
  return (
    <Section id="forecast-past" title={t('forecast.past.title')} lede={t('forecast.past.lede')}>
      <ForecastChart
        history={history}
        past={past}
        height={320}
        ariaLabel={t('forecast.past.aria')}
      />
      {coverage.all.tried > 0 && (
        <p className="footnote">
          {t('forecast.coverage', {
            months: COVERAGE_DISTANCE,
            held: coverage.all.held,
            tried: coverage.all.tried,
            recentHeld: coverage.recent.held,
            recentTried: coverage.recent.tried,
          })}
        </p>
      )}
    </Section>
  );
}

function MethodSection() {
  const { t, lang } = useI18n();
  return (
    <Section id="forecast-method" title={t('forecast.method.title')}>
      <p>{t('forecast.method.how', { months: MONTHS_PER_YEAR, margin: BAND_MARGIN_PERCENT })}</p>
      <p>{t('forecast.method.limits')}</p>
      <p>{t('forecast.method.scope')}</p>
      <p className="footnote">{t('forecast.method.disclaimer')}</p>
      <p className="footnote">
        <Link to={`/${lang}`}>{t('forecast.method.back')}</Link>
      </p>
    </Section>
  );
}
