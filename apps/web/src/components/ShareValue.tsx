import { useI18n } from '../i18n';
import { shareBand } from '../lib/stats';

/** A share in percent, coloured by band: none, up to half, more than half. */
export function ShareValue({ share }: { share: number | null }) {
  const { fmt } = useI18n();
  const band = shareBand(share);
  return <span className={band ? `share share--${band}` : undefined}>{fmt.pct(share)}</span>;
}
