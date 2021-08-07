import React, { useCallback, useRef, useState } from 'react';
import { createMapManager, MapManager } from '../core';
import { MapManagerContext } from './context';

interface MapProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function Map({ children, ...props }: MapProps) {
  const [map, setMM] = useState<MapManager>();
  const create = useCallback((r: HTMLDivElement | null) => {
    if (r) {
      const createdMap = createMapManager(r);
      setMM(createdMap);
    }
  }, []);

  return (
    <div ref={create} {...props}>
      {map && <MapManagerContext.Provider value={map}>{children}</MapManagerContext.Provider>}
    </div>
  );
}
