export type LatLng = [lat: number, lng: number];
export type Pixel = [x: number, y: number];

export interface Bounds {
  ne: LatLng;
  sw: LatLng;
}

export interface TileProvider {
  url: string;
  size: number;
  subdomains?: string[];
  zoomRange: { min: number; max: number };
}

export interface Size {
  width: number;
  height: number;
}

export type MinMaxBounds = [minLat: number, maxLat: number, minLng: number, maxLng: number];

export interface MoveEvent {
  timestamp: number;
  coords: Pixel;
}
