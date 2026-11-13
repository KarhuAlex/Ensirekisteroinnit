import { useMemo } from 'react';
import { Section, Skeleton, StatusPanel } from '../../components/ui';
import { useFleet } from '../../data/fleet';
import { useGeo } from '../../data/geo';
import { useRegional } from '../../data/regional';
import { useI18n } from '../../i18n';
import { areaGroupOf } from '../../lib/areaGrouping';
import {
  areasSectionState,
  entityAreaQuery,
  entityAreas,
  lastYearSpan,
} from '../../lib/entityAreas';
import { hasFleetMake } from '../../lib/fleetMakes';
import { useSeen } from '../../lib/hooks';
import { yearsOfSpans } from '../../lib/regionalPeriods';
import { rankAreas } from '../../lib/regionalRanking';
import { entityAreasPath } from '../../lib/reviewState';
import { ModelAreasBody } from './ModelAreasBody';

interface Props {
  /** A make, a model or a group of models. */
  entity: { id: string; kind: 'make' | 'model' | 'group' };
  /** The months of the national data, which say which years of the regional data to fetch. */
  months: readonly string[];
}

/**
 * Where a make, model or model group is registered: its share of the first registrations of each
 * region over the last year. Nothing is fetched until the section is near the screen.
 */
export function ModelAreas({ entity, months }: Props) {
  const { t, lang } = useI18n();
  const { ref, seen } = useSeen<HTMLDivElement>();
  const regional = useRegional(yearsOfSpans(lastYearSpan(months)), seen);
  const geo = useGeo(seen);
  // Only a make has an Autokanta page, so the fleet is asked for only then.
  const fleet = useFleet(seen && entity.kind === 'make');

  // The regional data has no entity that was never registered since it began.
  const covered = regional.status === 'ready' && regional.data.index.entities.includes(entity.id);
  const state = areasSectionState(regional.status, geo.status, covered);

  const result = useMemo(() => {
    if (state !== 'ready' || regional.status !== 'ready' || geo.status !== 'ready') return null;
    const span = lastYearSpan(regional.data.index.months);
    if (!span) return null;
    const ranking = rankAreas(
      regional.data,
      entityAreaQuery(entity.id, span),
      areaGroupOf('region', geo.data),
    );
    return { span, areas: entityAreas(ranking) };
  }, [state, regional, geo, entity.id]);

  if (state === 'hidden') return null;
  const stockPath =
    fleet.status === 'ready' && hasFleetMake(fleet.data, entity.id)
      ? `/${lang}/stock?make=${encodeURIComponent(entity.id)}`
      : null;

  return (
    <div ref={ref}>
      <Section id="model-areas" title={t('model.areas.title')}>
        {state === 'failed' ? (
          <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />
        ) : result ? (
          <ModelAreasBody
            areas={result.areas}
            span={result.span}
            reviewPath={entityAreasPath(lang, months, entity.id, result.span)}
            stockPath={stockPath}
          />
        ) : (
          <div className="loading" role="status" aria-label={t('status.loading')}>
            <Skeleton height={260} />
          </div>
        )}
      </Section>
    </div>
  );
}
