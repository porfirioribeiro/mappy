export type LatLng = [lat: number, lng: number];

export interface TileProvider {
  url: string;
  size: number;
  subdomains?: string[];
  reverseY?: boolean;
  zoomRange: { min: number; max: number };
}

export interface Size {
  width: number;
  height: number;
}
