import { TileProvider } from './types';

export const osmTileProvider: TileProvider = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  size: 256,
  subdomains: ['a', 'b', 'c'],
  zoomRange: { min: 1, max: 17 },
};

export const gmapsTileProvider: TileProvider = {
  url: 'https://mt{s}.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}',
  size: 256,
  subdomains: ['0', '1', '2', '3'],
  zoomRange: { min: 1, max: 21 },
};

///hibrid overlay
///https://mt{s}.google.com/vt/lyrs=h@186112443&hl=en&x={x}&y={y}&z={z}
// h = roads only
// m = standard roadmap
// p = terrain
// r = somehow altered roadmap
// s = satellite only
// t = terrain only
// y = hybrid

// todo

export function osm(x: number, y: number, z: number): string {
  const s = String.fromCharCode(97 + ((x + y + z) % 3));
  return `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export function getTileUrl(
  { url, subdomains }: TileProvider,
  tileX: number,
  tileY: number,
  zoom: number,
) {
  let tileUrl = url.replace('{z}', `${zoom}`).replace('{x}', `${tileX}`).replace('{y}', `${tileY}`);

  if (subdomains && subdomains.length > 0) {
    // replace subdomain with random domain from subdomains array
    tileUrl = tileUrl.replace('{s}', subdomains[(tileX + tileY) % subdomains.length]);
  }

  return tileUrl;
}

// export function stamenToner(x: number, y: number, z: number, dpr = 1): string {
//   return `https://stamen-tiles.a.ssl.fastly.net/toner/${z}/${x}/${y}${dpr >= 2 ? '@2x' : ''}.png`;
// }

// export function stamenTerrain(x: number, y: number, z: number, dpr = 1): string {
//   return `https://stamen-tiles.a.ssl.fastly.net/terrain/${z}/${x}/${y}${dpr >= 2 ? '@2x' : ''}.jpg`;
// }
