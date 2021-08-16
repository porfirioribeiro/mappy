import React, { useCallback, useRef, useState } from 'react';
import { createMapManager, MapManager, MapManagerOptions, MapManagerProps } from '../core';
import { MapManagerContext } from './context';

interface MapProps extends MapManagerOptions {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function Map({ children, className, style, ...props }: MapProps) {
  const [map, setMap] = useState<MapManager>();
  const create = useCallback((r: HTMLDivElement | null) => {
    if (r) {
      const m = createMapManager(r, props);
      setMap(m);
    } else if (map) {
      map.dispose();
    }
  }, []);

  return (
    <div
      ref={create}
      className={className}
      style={{ ...style, position: 'relative', overflow: 'hidden' }}
    >
      {map && <MapManagerContext.Provider value={map}>{children}</MapManagerContext.Provider>}
    </div>
  );
}
