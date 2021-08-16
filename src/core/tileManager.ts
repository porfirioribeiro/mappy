import { MapManager } from './manager';
import { TileValues } from './tile';
import { getTileUrl } from './tileProviders';
import { Tile, TileProvider } from './types';

interface TileManagerOptions {
  onUpdateTiles(tiles: Tile[]): void;
  provider: TileProvider;
}

export function createTileManager(
  mapManager: MapManager,
  { provider, onUpdateTiles }: TileManagerOptions,
) {
  console.log('create tiles');

  mapManager.on('update', update);

  function update() {
    console.log('update map', mapManager.center);

    onUpdateTiles([]);
  }

  function getTiles(tileValues: TileValues) {
    const { tileMinX, tileMaxX, tileMinY, tileMaxY, roundedZoom } = tileValues;

    const tiles: Tile[] = [];

    const xMin = Math.max(tileMinX, 0);
    const yMin = Math.max(tileMinY, 0);
    const xMax = Math.min(tileMaxX, Math.pow(2, roundedZoom) - 1);
    const yMax = Math.min(tileMaxY, Math.pow(2, roundedZoom) - 1);

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({
          key: `${x}-${y}-${roundedZoom}`,
          url: getTileUrl(provider, x, y, roundedZoom),
          left: (x - tileMinX) * 256,
          top: (y - tileMinY) * 256,
          width: 256,
          height: 256,
          active: true,
        });
      }
    }

    return tiles;
  }

  function dispose() {
    mapManager.off('update', update);
  }

  return { dispose, getTiles };
}
