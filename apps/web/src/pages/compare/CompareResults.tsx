import type { EntitySummary, Matrix } from '@regs/core';
import { useMemo } from 'react';
import { RangeControl } from '../../components/RangeControl';
import { Section, Segmented } from '../../components/ui';
import { useI18n } from '../../i18n';
import {
  COMPARE_METRICS,
  compareSeries,
  metricUnit,
  summarize,
  type CompareMetric,
} from '../../lib/comparison';
import type { Timeline } from '../../lib/hooks';
import { displayName } from '../../lib/names';
import { CompareChart } from './CompareChart';
import { CompareTable } from './CompareTable';

const CHART_HEIGHT = 340;

interface Props {
  matrix: Matrix;
  months: string[];
  chosen: EntitySummary[];
  slots: ReadonlyMap<string, number>;
  metric: CompareMetric;
  timeline: Timeline;
  onMetric: (metric: CompareMetric) => void;
}

interface Identity {
  name: string;
  slot: number;
}

const identityOf = (identity: ReadonlyMap<string, Identity>, id: string): Identity =>
  identity.get(id) ?? { name: id, slot: 0 };

/** The chart of the chosen things over time, and a table of their last 12 months. */
export function CompareResults({
  matrix,
  months,
  chosen,
  slots,
  metric,
  timeline,
  onMetric,
}: Props) {
  const { t } = useI18n();
  const ids = useMemo(() => chosen.map((e) => e.id), [chosen]);
  const identity = useMemo(
    () =>
      new Map(
        chosen.map((e) => [e.id, { name: displayName(e.label), slot: slots.get(e.id) ?? 0 }]),
      ),
    [chosen, slots],
  );
  const lines = useMemo(
    () => compareSeries(matrix, ids, metric).map((s) => ({ ...s, ...identityOf(identity, s.id) })),
    [matrix, ids, metric, identity],
  );
  const rows = useMemo(
    () => summarize(matrix, ids).map((s) => ({ ...s, ...identityOf(identity, s.id) })),
    [matrix, ids, identity],
  );

  return (
    <>
      <Section
        id="compare-chart"
        title={t('compare.chartTitle')}
        tools={<RangeControl value={timeline.range} onChange={timeline.setRange} />}
      >
        <Segmented
          label={t('compare.metric')}
          value={metric}
          options={COMPARE_METRICS.map((m) => ({ value: m, label: t(`compare.metric.${m}`) }))}
          onChange={onMetric}
        />
        <CompareChart
          months={months}
          lines={lines}
          unit={metricUnit(metric)}
          timeline={timeline}
          height={CHART_HEIGHT}
          ariaLabel={t('compare.aria', { metric: t(`compare.metric.${metric}`) })}
        />
      </Section>
      <Section id="compare-table" title={t('compare.tableTitle')}>
        <CompareTable rows={rows} />
      </Section>
    </>
  );
}
