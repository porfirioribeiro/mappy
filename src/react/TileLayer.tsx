import React from 'react';
import { useMap } from './context';

interface TileLayerProps {}

export function TileLayer(props: TileLayerProps) {
  const map = useMap();

  console.log(map.container);

  return <div>Tile layer</div>;
}
