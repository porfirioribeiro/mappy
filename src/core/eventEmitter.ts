import { LatLng, Size } from './types';

export type Events = {
  center: LatLng;
  zoom: number;
  size: Size;
  update: void;
};

export type EventName = keyof Events;
