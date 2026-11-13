import { useI18n } from '../i18n';

interface Props {
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

interface ButtonProps {
  label?: string;
  enabled: boolean;
  onPress: () => void;
  className: string;
  children: string;
}

/** Disabled with `aria-disabled`, so a button that has just used up its range keeps the focus. */
function ZoomButton({ label, enabled, onPress, className, children }: ButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => enabled && onPress()}
      aria-disabled={!enabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}

/** Zoom buttons laid over a corner of a map. */
export function MapZoomControls({ canZoomIn, canZoomOut, onZoomIn, onZoomOut, onReset }: Props) {
  const { t } = useI18n();
  return (
    <div className="map-zoom" role="group" aria-label={t('map.zoom')}>
      <ZoomButton
        className="map-zoom-button"
        label={t('map.zoomIn')}
        enabled={canZoomIn}
        onPress={onZoomIn}
      >
        +
      </ZoomButton>
      <ZoomButton
        className="map-zoom-button"
        label={t('map.zoomOut')}
        enabled={canZoomOut}
        onPress={onZoomOut}
      >
        −
      </ZoomButton>
      <ZoomButton className="map-zoom-button map-zoom-reset" enabled={canZoomOut} onPress={onReset}>
        {t('map.zoomReset')}
      </ZoomButton>
    </div>
  );
}
