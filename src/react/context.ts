import { createContext, useContext, useLayoutEffect, useReducer } from 'react';
import { MapManager } from '../core';
import { EventName } from '../core/eventEmitter';

export const MapManagerContext = createContext<MapManager | null>(null);

export function useMap(events: EventName[] = []) {
  const [, update] = useReducer(v => !v, false);
  const map = useContext(MapManagerContext);
  if (!map) throw 'useMap called out of map';

  useLayoutEffect(() => {
    events.forEach(e => map.on(e, update));
    return () => events.forEach(e => map.off(e, update));
  }, events);

  return map;
}
