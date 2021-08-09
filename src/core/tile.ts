import { getPosition, getSize } from './domUtils';
import { LatLng, MinMaxBounds, Size } from './types';

// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
export function lng2tile(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

export function lat2tile(lat: number, zoom: number): number {
  return (
    ((1 -
      Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
      2) *
    Math.pow(2, zoom)
  );
}

export function tile2lng(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180;
}

export function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

// minLat, maxLat, minLng, maxLng
export const absoluteMinMax = [
  tile2lat(Math.pow(2, 10), 10),
  tile2lat(0, 10),
  tile2lng(0, 10),
  tile2lng(Math.pow(2, 10), 10),
] as MinMaxBounds;

export function tileValues(
  { width, height }: Size,
  center: LatLng,
  zoom: number,
  pixelDelta?: LatLng | null,
  zoomDelta: number = 0,
): TileValues {
  const roundedZoom = Math.round(zoom + zoomDelta);
  const zoomDiff = zoom + zoomDelta - roundedZoom;

  const scale = Math.pow(2, zoomDiff);
  const scaleWidth = width / scale;
  const scaleHeight = height / scale;

  const tileCenterX =
    lng2tile(center[1], roundedZoom) - (pixelDelta ? pixelDelta[0] / 256.0 / scale : 0);
  const tileCenterY =
    lat2tile(center[0], roundedZoom) - (pixelDelta ? pixelDelta[1] / 256.0 / scale : 0);

  const halfWidth = scaleWidth / 2 / 256.0;
  const halfHeight = scaleHeight / 2 / 256.0;

  const tileMinX = Math.floor(tileCenterX - halfWidth);
  const tileMaxX = Math.floor(tileCenterX + halfWidth);

  const tileMinY = Math.floor(tileCenterY - halfHeight);
  const tileMaxY = Math.floor(tileCenterY + halfHeight);

  return {
    tileMinX,
    tileMaxX,
    tileMinY,
    tileMaxY,
    tileCenterX,
    tileCenterY,
    roundedZoom,
    zoomDelta,
    scaleWidth,
    scaleHeight,
    scale,
  };
}

export interface TileValues {
  tileMinX: number;
  tileMaxX: number;
  tileMinY: number;
  tileMaxY: number;
  tileCenterX: number;
  tileCenterY: number;
  roundedZoom: number;
  zoomDelta: number;
  scaleWidth: number;
  scaleHeight: number;
  scale: number;
}
