import { useMemo } from 'react';
import { AreaMap } from '../../components/AreaMap';
import type { Geo } from '../../data/geo';
import { useI18n } from '../../i18n';
import { areaMapOption, type MapDatum } from '../../lib/charts';
import type { AreaLevel } from '../../lib/reviewState';
import { useThemeColors } from '../../lib/theme';

const MAP_HEIGHT = 560;

interface Props {
  /** One value for each area that has one; the areas with none stay grey. */
  data: readonly MapDatum[];
  /** The share, in percent, that the colour scale ends at. */
  scaleTop: number;
  level: AreaLevel;
  geo: Geo;
  title: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** A share for each region or municipality, drawn as a map. */
export function FleetMap({ data, scaleTop, level, geo, title, selectedId, onSelect }: Props) {
  const mapName = level === 'region' ? 'maakunta' : 'kunta';
  const { fmt } = useI18n();
  const colors = useThemeColors();

  const option = useMemo(
    () =>
      areaMapOption({
        colors,
        mapName,
        selectedId,
        data,
        scale: { min: 0, max: scaleTop },
        diverging: false,
        formatValue: (value) => fmt.pct(value),
        noDataColor: colors.rule,
      }),
    [data, scaleTop, mapName, selectedId, colors, fmt],
  );

  return (
    <AreaMap
      mapName={mapName}
      geo={level === 'region' ? geo.regions : geo.municipalities}
      onSelect={onSelect}
      option={option}
      height={MAP_HEIGHT}
      ariaLabel={title}
    />
  );
}
