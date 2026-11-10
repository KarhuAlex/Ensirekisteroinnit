import { Facts } from '../../components/ui';
import { useI18n } from '../../i18n';
import { metricValue } from '../../lib/areaMetrics';
import type { AreaRanking } from '../../lib/regionalRanking';
import type { AreaMetric } from '../../lib/reviewState';
import type { AreaTableRow } from '../../components/AreaTable';
import { formatMetric } from './formatMetric';

interface Props {
  national: AreaRanking['national'];
  rows: readonly AreaTableRow[];
  metric: AreaMetric;
}

export function AreaFacts({ national, rows, metric }: Props) {
  const { t, fmt } = useI18n();
  const top = rows
    .map((row) => ({ row, value: metricValue(row, metric) }))
    .filter((entry): entry is { row: AreaTableRow; value: number } => entry.value !== null)
    .sort((a, b) => b.value - a.value)[0];

  return (
    <Facts
      items={[
        {
          label: t('review.kpi.national'),
          value: fmt.int(national.count),
          note: t('review.kpi.nationalNote', { share: fmt.pct(national.share) }),
        },
        ...(top
          ? [
              {
                label: t('review.kpi.topArea', {
                  metric: t(`review.metric.${metric}`).toLowerCase(),
                }),
                value: top.row.label,
                note: formatMetric(top.value, metric, t, fmt),
              },
            ]
          : []),
        { label: t('review.kpi.areas'), value: fmt.int(rows.filter((r) => r.reliable).length) },
      ]}
    />
  );
}
