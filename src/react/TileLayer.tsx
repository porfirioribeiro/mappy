import React, { useRef } from 'react';
import { getTileUrl, gmapsTileProvider, osm, osmTileProvider } from '../core';
import { TileValues, tileValues } from '../core/tile';
import { useMap } from './context';

interface TileLayerProps {}

export interface Tile {
  key: string;
  url: string;
  //   srcSet: string;
  left: number;
  top: number;
  width: number;
  height: number;
  active: boolean;
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
        url: getTileUrl(gmapsTileProvider, x, y, roundedZoom),
        // srcSet: srcSet(dprs, mapUrl, x, y, roundedZoom),
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

export function TileLayer(props: TileLayerProps) {
  const map = useMap(['update']);

  const { width, height } = map.size;

  const mapUrl = osm;

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
    tiles = tiles.concat(getTiles(tvRef.current));

    tvRef.current = tileValues;
  }

  tiles = tiles.concat(getTiles(tileValues));

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
    transform: `translate(${left}px, ${top}px)`,
  };

  return (
    <div style={boxStyle} className={boxClassname}>
      <div className="pigeon-tiles" style={tilesStyle}>
        {tiles.map(tile => (
          <img
            key={tile.key}
            src={tile.url}
            // srcSet={tile.srcSet}
            width={tile.width}
            height={tile.height}
            loading={'lazy'}
            // onLoad={() => this.imageLoaded(tile.key)}
            alt={''}
            style={{
              position: 'absolute',
              left: tile.left,
              top: tile.top,
              willChange: 'transform',
              // TODO: check this
              // transform: tile.transform,
              transformOrigin: 'top left',
              opacity: 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}
