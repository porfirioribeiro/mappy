import { LatLng, Size } from './types';

export type Events = {
  center: LatLng;
  zoom: number;
  size: Size;
};

export type EventName = keyof Events;
