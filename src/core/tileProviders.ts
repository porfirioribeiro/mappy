import { TileProvider } from './types';

export const osmTileProvider: TileProvider = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  size: 256,
  subdomains: ['a', 'b', 'c'],
  reverseY: false,
  zoomRange: { min: 1, max: 17 },
};

export const gmapsTileProvider: TileProvider = {
  url: 'https://mt{s}.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}',
  size: 256,
  subdomains: ['0', '1', '2', '3'],
  zoomRange: { min: 1, max: 21 },
};

// todo

// export function stamenToner(x: number, y: number, z: number, dpr = 1): string {
//   return `https://stamen-tiles.a.ssl.fastly.net/toner/${z}/${x}/${y}${dpr >= 2 ? '@2x' : ''}.png`;
// }

// export function stamenTerrain(x: number, y: number, z: number, dpr = 1): string {
//   return `https://stamen-tiles.a.ssl.fastly.net/terrain/${z}/${x}/${y}${dpr >= 2 ? '@2x' : ''}.jpg`;
// }
