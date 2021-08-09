import React, { useCallback, useRef, useState } from 'react';
import { createMapManager, MapManager } from '../core';
import { MapManagerContext } from './context';

interface MapProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function Map({ children, ...props }: MapProps) {
  const [map, setMap] = useState<MapManager>();
  const create = useCallback((r: HTMLDivElement | null) => {
    if (r) {
      const m = createMapManager(r, {});
      setMap(m);
    } else if (map) {
      map.dispose();
    }
  }, []);

  return (
    <div ref={create} {...props} style={{ position: 'relative', overflow: 'hidden' }}>
      {map && <MapManagerContext.Provider value={map}>{children}</MapManagerContext.Provider>}
    </div>
  );
}
