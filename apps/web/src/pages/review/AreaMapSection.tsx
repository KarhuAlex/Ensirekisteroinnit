import { useMemo } from 'react';
import { AreaMap } from '../../components/AreaMap';
import type { AreaTableRow } from '../../components/AreaTable';
import type { Geo } from '../../data/geo';
import { useI18n } from '../../i18n';
import { colourScale, isDiverging, metricValue } from '../../lib/areaMetrics';
import { areaMapOption, type MapDatum } from '../../lib/charts';
import { MIN_AREA_BASE } from '../../lib/regionalRanking';
import type { AreaLevel, AreaMetric } from '../../lib/reviewState';
import { useThemeColors } from '../../lib/theme';
import { formatMetric, type Formatters, type Translate } from './formatMetric';

const MAP_HEIGHT = 560;

interface Props {
  rows: readonly AreaTableRow[];
  metric: AreaMetric;
  areaLevel: AreaLevel;
  geo: Geo;
  periodLabel: string;
}

function tooltipLines(
  row: AreaTableRow,
  value: number | null,
  metric: AreaMetric,
  t: Translate,
  fmt: Formatters,
): string[] {
  const shown = value === null ? t('review.col.unreliable') : formatMetric(value, metric, t, fmt);
  return [
    row.label,
    `${t(`review.metric.${metric}`)}: ${shown}`,
    `${t('review.col.count')}: ${fmt.int(row.count)}`,
    `${t('review.col.total')}: ${fmt.int(row.total)}`,
  ];
}

export function AreaMapSection({ rows, metric, areaLevel, geo, periodLabel }: Props) {
  const { t, fmt } = useI18n();
  const colors = useThemeColors();
  const byRegion = areaLevel === 'region';
  const mapName = byRegion ? 'maakunta' : 'kunta';
  const title = t('review.map.title', {
    metric: t(`review.metric.${metric}`),
    period: periodLabel,
  });

  const option = useMemo(() => {
    const data: MapDatum[] = rows
      .filter((row) => row.kind === 'municipality' || row.kind === 'region')
      .map((row) => {
        const value = metricValue(row, metric);
        return { id: row.id, value, tooltip: tooltipLines(row, value, metric, t, fmt) };
      });
    return areaMapOption({
      colors,
      mapName,
      data,
      scale: colourScale(
        data.map((d) => d.value),
        metric,
      ),
      diverging: isDiverging(metric),
      formatValue: (v) => formatMetric(v, metric, t, fmt),
      noDataColor: colors.rule,
    });
  }, [rows, metric, mapName, colors, t, fmt]);

  return (
    <section className="block" aria-label={title}>
      <AreaMap
        mapName={mapName}
        geo={byRegion ? geo.regions : geo.municipalities}
        option={option}
        height={MAP_HEIGHT}
        ariaLabel={title}
      />
      <p className="footnote">
        {t('review.map.noData', { min: MIN_AREA_BASE })} {t('review.geo.source')}
      </p>
    </section>
  );
}
