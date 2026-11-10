import { useI18n } from '../i18n';
import { RANGE_IDS, type RangeId } from '../lib/stats';
import { Segmented } from './ui';

/** The period buttons (all, 5 years, 2 years, 12 months) that the time charts share. */
export function RangeControl({
  value,
  onChange,
}: {
  value: RangeId;
  onChange: (range: RangeId) => void;
}) {
  const { t } = useI18n();
  return (
    <Segmented
      label={t('range.label')}
      value={value}
      options={RANGE_IDS.map((r) => ({ value: r, label: t(`range.${r}`) }))}
      onChange={onChange}
    />
  );
}
