import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getTileUrl, gmapsTileProvider, osmTileProvider, Tile, TileProvider } from '../core';
import { TileValues, tileValues } from '../core/tile';
import { createTileManager } from '../core/tileManager';
import { useMap } from './context';

interface TileLayerProps {
  provider: TileProvider;
}

export function TileLayer({ provider = osmTileProvider }: TileLayerProps) {
  const map = useMap();

  const [_tiles, onUpdateTiles] = useState<Tile[]>([]);

  const tileManager = useMemo(
    () => createTileManager(map, { provider, onUpdateTiles }),
    [map, provider],
  );

  useEffect(() => tileManager.dispose, [tileManager]);

  const { width, height } = map.size;

  const tileValues = map.tileValues();

  const tvRef = useRef(tileValues);

  const {
    tileMinX,
    tileMaxX,
    tileMinY,
    tileMaxY,
    tileCenterX,
    tileCenterY,
    scaleWidth,
    scaleHeight,
    scale,
  } = tileValues;

  let tiles: Tile[] = [];

  if (tvRef.current.roundedZoom != tileValues.roundedZoom) {
    tiles = tiles.concat(tileManager.getTiles(tvRef.current));

    tvRef.current = tileValues;
  }

  tiles = tiles.concat(tileManager.getTiles(tileValues));

  const boxStyle: React.CSSProperties = {
    width: scaleWidth,
    height: scaleHeight,
    position: 'absolute',
    top: `calc((100% - ${height}px) / 2)`,
    left: `calc((100% - ${width}px) / 2)`,
    overflow: 'hidden',
    willChange: 'transform',
    transform: `scale(${scale}, ${scale})`,
    transformOrigin: 'top left',
  };
  const boxClassname = 'pigeon-tiles-box';

  const left = -((tileCenterX - tileMinX) * 256 - scaleWidth / 2);
  const top = -((tileCenterY - tileMinY) * 256 - scaleHeight / 2);

  const tilesStyle: React.CSSProperties = {
    position: 'absolute',
    width: (tileMaxX - tileMinX + 1) * 256,
    height: (tileMaxY - tileMinY + 1) * 256,
    willChange: 'transform',
    transform: `translate3d(${left}px, ${top}px, 0px) scale(1)`,
  };

  return (
    <div style={boxStyle} className={boxClassname}>
      <div className="pigeon-tiles" style={tilesStyle}>
        {tiles.map(tile => {
          return (
            <img
              key={tile.key}
              src={tile.url}
              loading={'lazy'}
              // onLoad={() => this.imageLoaded(tile.key)}
              alt={''}
              style={{
                position: 'absolute',
                width: tile.width,
                height: tile.height,
                willChange: 'transform',
                transform: `translate3d(${tile.left}px, ${tile.top}px, 0px) scale(1.003)`,
                opacity: 1,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
