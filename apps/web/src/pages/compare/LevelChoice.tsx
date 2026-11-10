import { useId } from 'react';
import { useI18n } from '../../i18n';
import type { EntityLevel } from '../../lib/entityLevel';

interface Props {
  /** Level of the first chosen item, or `null` if none is chosen. */
  level: EntityLevel | null;
  allowMixedLevels: boolean;
  onChange: (allow: boolean) => void;
}

/** Checkbox for mixing levels, with a hint about what the current setting does. */
export function LevelChoice({ level, allowMixedLevels, onChange }: Props) {
  const { t } = useI18n();
  const hintId = useId();
  const hint = hintFor(t, level, allowMixedLevels);
  return (
    <>
      <label className="check">
        <input
          type="checkbox"
          checked={allowMixedLevels}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        {t('compare.mixed')}
      </label>
      {hint && (
        <p id={hintId} className="muted hint">
          {hint}
        </p>
      )}
    </>
  );
}

function hintFor(
  t: ReturnType<typeof useI18n>['t'],
  level: EntityLevel | null,
  allowMixedLevels: boolean,
): string | null {
  if (allowMixedLevels) return t('compare.mixedHint');
  if (!level) return null;
  return t('compare.sameLevel', { level: t(`review.level.${level}`).toLowerCase() });
}
