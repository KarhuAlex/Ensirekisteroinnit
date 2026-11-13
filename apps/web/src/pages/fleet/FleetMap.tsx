import { useMemo } from 'react';
import { AreaMap } from '../../components/AreaMap';
import type { Geo } from '../../data/geo';
import { useI18n } from '../../i18n';
import { areaMapOption, type MapDatum } from '../../lib/charts';
import {
  MIN_MUNICIPALITY_CARS,
  mapScaleTop,
  type ElectricShare,
  type FleetAreaRow,
} from '../../lib/fleet';
import type { AreaLevel } from '../../lib/reviewState';
import { useThemeColors } from '../../lib/theme';

const MAP_HEIGHT = 560;

interface Props {
  rows: readonly FleetAreaRow[];
  kind: ElectricShare;
  level: AreaLevel;
  geo: Geo;
  title: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** The electric share of the cars of each area; the ones with too few cars stay grey. */
export function FleetMap({ rows, kind, level, geo, title, selectedId, onSelect }: Props) {
  const mapName = level === 'region' ? 'maakunta' : 'kunta';
  const { t, fmt } = useI18n();
  const colors = useThemeColors();

  const option = useMemo(() => {
    const label = t(kind === 'bev' ? 'chart.bevLine' : 'chart.plugLine');
    const data: MapDatum[] = rows.map((row) => {
      const share = kind === 'bev' ? row.bevShare : row.plugShare;
      const shown = row.reliable
        ? fmt.pct(share)
        : t('fleet.col.unreliable', { min: fmt.int(MIN_MUNICIPALITY_CARS) });
      return {
        id: row.id,
        value: row.reliable ? share : null,
        tooltip: [row.name, `${label}: ${shown}`, `${t('fleet.col.cars')}: ${fmt.int(row.cars)}`],
      };
    });
    return areaMapOption({
      colors,
      mapName,
      selectedId,
      data,
      scale: { min: 0, max: mapScaleTop(rows, kind) },
      diverging: false,
      formatValue: (value) => fmt.pct(value),
      noDataColor: colors.rule,
    });
  }, [rows, kind, mapName, selectedId, colors, t, fmt]);

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
