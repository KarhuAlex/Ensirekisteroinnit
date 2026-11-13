import { FUEL_GROUP_OF, FUEL_IDS, type FuelId } from '@regs/core';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FuelChart } from '../components/FuelChart';
import { FuelMark } from '../components/FuelMark';
import { Icon } from '../components/Icon';
import { SearchBox } from '../components/SearchBox';
import {
  Facts,
  PageHeader,
  Section,
  Segmented,
  Skeleton,
  StatusPanel,
  usePageTitle,
} from '../components/ui';
import { SourceNote } from '../components/SourceNote';
import { ModelAreas } from './model/ModelAreas';
import { useCatalog, useEntitySeries } from '../data/DataProvider';
import { dataOf, hasFailed } from '../data/remote';
import { useTimeAxis } from '../data/useTimeAxis';
import { useI18n } from '../i18n';
import { hasPage } from '../lib/entityLevel';
import { comparePath } from '../lib/compareState';
import { displayName } from '../lib/names';
import { buildSeriesView } from '../lib/seriesView';
import { MONTHS_PER_YEAR, modelStory, percent, sumRange } from '../lib/stats';

type Granularity = 'monthly' | 'yearly';

export function ModelDetail() {
  const { id } = useParams();
  const { lang, t, fmt } = useI18n();
  const { manifest, byId, entities } = useCatalog();
  const [granularity, setGranularity] = useState<Granularity>('monthly');
  const found = id ? byId.get(id) : undefined;
  const entity = found && hasPage(found.kind) ? found : undefined;
  const seriesState = useEntitySeries(id);
  const series = dataOf(seriesState);
  const failed = hasFailed(seriesState);

  const name = entity
    ? entity.kind === 'total'
      ? t('entity.total')
      : displayName(entity.label)
    : '';
  usePageTitle(entity ? `${name} – ${t('app.title')}` : t('model.notFound'));

  const axis = useTimeAxis();
  const n = manifest.months.length;

  const view = useMemo(() => {
    if (!series) return null;
    const seriesView = buildSeriesView(series, manifest.months);
    const { grouped, totals } = seriesView;
    const first = totals.findIndex((v) => v > 0);
    const last12 = sumRange(totals, n - MONTHS_PER_YEAR, n);
    const bev12 = sumRange(grouped.bev, n - MONTHS_PER_YEAR, n);
    return {
      ...seriesView,
      first: first >= 0 ? (manifest.months[first] ?? null) : null,
      latest: totals[n - 1] ?? 0,
      total: sumRange(totals, 0, n),
      last12,
      bevShare12: percent(bev12, last12),
      story: modelStory(last12, bev12),
    };
  }, [series, n, manifest.months]);

  const yearCategories = useMemo(
    () => (view ? axis.yearLabels(view.annual.years) : []),
    [view, axis],
  );

  const related = useMemo(() => {
    if (!entity) return [];
    const makeId = entity.kind === 'make' ? entity.id : entity.makeId;
    if (!makeId) return [];
    return entities
      .filter((e) => e.makeId === makeId && e.id !== entity.id && e.kind !== 'group')
      .sort((a, b) => b.last12 - a.last12 || b.total - a.total)
      .slice(0, 12);
  }, [entity, entities]);

  const fuelRows = useMemo(() => {
    if (!series) return [];
    return FUEL_IDS.flatMap((fuel: FuelId) => {
      const values = series.series[fuel];
      if (!values) return [];
      return [
        { fuel, last12: sumRange(values, n - MONTHS_PER_YEAR, n), total: sumRange(values, 0, n) },
      ];
    }).sort((a, b) => b.total - a.total);
  }, [series, n]);

  if (!entity) {
    return (
      <StatusPanel
        title={t('model.notFound')}
        hint={t('search.emptyHint')}
        action={<SearchBox variant="hero" />}
      />
    );
  }

  const parent = entity.makeId ? byId.get(entity.makeId) : undefined;
  const story = view?.story;
  const storyText = !story
    ? ''
    : story.kind === 'none'
      ? t('story.model.none')
      : story.kind === 'all-electric'
        ? t('story.model.all', { n: fmt.int(story.count) })
        : t('story.model.mixed', { n: fmt.int(story.count), share: fmt.pct(story.bevShare) });

  return (
    <>
      <nav className="breadcrumb" aria-label={t('model.breadcrumb')}>
        <Link to={`/${lang}/models`}>{t('model.allModels')}</Link>
        {parent && (
          <>
            <Icon name="arrowRight" size={14} />
            <Link to={`/${lang}/models/${parent.id}`}>{displayName(parent.label)}</Link>
          </>
        )}
      </nav>

      <PageHeader title={name} lede={storyText || undefined}>
        <p className="plate-row">
          <span className="plate">{t(`kind.${entity.kind}`)}</span>
          {entity.kind !== 'total' && (
            <Link className="button" to={comparePath(lang, [entity.id])}>
              {t('compare.compareWith')}
            </Link>
          )}
          {view?.first && (
            <span className="muted">
              {t('model.since', {
                from: fmt.month(view.first),
                to: fmt.month(manifest.latestMonth),
              })}
            </span>
          )}
        </p>
      </PageHeader>

      {failed ? (
        <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />
      ) : !view ? (
        <div className="loading" role="status" aria-label={t('status.loading')}>
          <Skeleton height={72} />
          <Skeleton height={400} />
        </div>
      ) : (
        <>
          <Section
            id="model-chart"
            title={t('model.chartTitle')}
            footnote={
              <SourceNote
                extra={
                  granularity === 'yearly' && axis.incompleteYear
                    ? t('chart.partialYear', { month: fmt.month(manifest.latestMonth) })
                    : undefined
                }
              />
            }
            tools={
              <Segmented
                label={t('chart.granularity')}
                value={granularity}
                options={[
                  { value: 'monthly', label: t('chart.monthly') },
                  { value: 'yearly', label: t('chart.yearly') },
                ]}
                onChange={setGranularity}
              />
            }
          >
            {granularity === 'monthly' ? (
              <FuelChart
                key={`${id}-monthly`}
                categories={manifest.months}
                labels={axis.monthLabels}
                grouped={view.grouped}
                monthly
                initialMode="count"
                switchableMode
                withRanges
                height={380}
                ariaLabel={`${name}: ${t('model.chartTitle')}`}
              />
            ) : (
              <FuelChart
                key={`${id}-yearly`}
                categories={yearCategories}
                labels={yearCategories}
                grouped={view.annual.grouped}
                monthly={false}
                initialMode="count"
                switchableMode
                withRanges={false}
                height={380}
                ariaLabel={`${name}: ${t('model.chartTitle')}`}
              />
            )}
          </Section>
          <Facts
            items={[
              { label: t('model.kpiTotal'), value: fmt.int(view.total) },
              { label: t('model.kpiLast12'), value: fmt.int(view.last12) },
              {
                label: t('model.kpiLatest', { month: fmt.month(manifest.latestMonth) }),
                value: fmt.int(view.latest),
              },
              { label: t('model.kpiBev'), value: fmt.pct(view.bevShare12) },
            ]}
          />

          <div className="two-up">
            <Section id="fuel-table" title={t('model.fuelBreakdown')}>
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label={t('model.fuelCaption')}
              >
                <table className="data-table">
                  <caption className="sr-only">{t('model.fuelCaption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('model.col.fuel')}</th>
                      <th scope="col" className="num">
                        {t('models.col.last12')}
                      </th>
                      <th scope="col" className="num">
                        {t('models.col.total')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fuelRows.map((r) => (
                      <tr key={r.fuel}>
                        <td>
                          <span className="cell-mark">
                            <FuelMark group={FUEL_GROUP_OF[r.fuel]} />
                            {t(`fuel.${r.fuel}`)}
                          </span>
                        </td>
                        <td className="num">{fmt.int(r.last12)}</td>
                        <td className="num">{fmt.int(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {related.length > 0 && (
              <Section
                id="related"
                title={entity.kind === 'make' ? t('model.modelsOfMake') : t('model.sameMake')}
              >
                <ul className="link-list">
                  {related.map((e) => (
                    <li key={e.id}>
                      <Link to={`/${lang}/models/${e.id}`}>{displayName(e.label)}</Link>
                      <span className="muted num">
                        {fmt.int(e.last12)} {t('search.per12')}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>

          {(entity.kind === 'make' || entity.kind === 'model' || entity.kind === 'group') && (
            <ModelAreas entity={{ id: entity.id, kind: entity.kind }} months={manifest.months} />
          )}
        </>
      )}
    </>
  );
}
