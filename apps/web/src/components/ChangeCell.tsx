import { useI18n } from '../i18n';
import { changeOf } from '../lib/ranking';
import { toneOf } from '../lib/stats';
import { Icon } from './Icon';

/** The change from a comparison figure: an arrow and a percentage, or the plain difference. */
export function ChangeCell({ count, previous }: { count: number; previous: number | null }) {
  const { fmt } = useI18n();
  const change = changeOf(count, previous);
  if (!change) return <span className="muted">–</span>;
  const tone = toneOf(change.delta);
  const text =
    change.percent !== null ? fmt.signedPct(change.percent) : fmt.signedInt(change.delta);
  return (
    <span className={`change change--${tone}`}>
      {change.delta !== 0 && <Icon name={change.delta > 0 ? 'arrowUp' : 'arrowDown'} size={14} />}
      {text}
    </span>
  );
}
