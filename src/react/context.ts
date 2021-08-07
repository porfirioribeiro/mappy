import { createContext, useContext } from 'react';
import { MapManager } from '../core';

export const MapManagerContext = createContext<MapManager | null>(null);

export function useMap() {
  return useContext(MapManagerContext) ?? fail('useMap called out of map');
}

function fail<T>(m: string): Required<T> {
  throw m;
}
