import React from 'react';
import { useMap } from './context';

interface TileLayerProps {}

export function TileLayer(props: TileLayerProps) {
  const map = useMap(['size']);

  console.log(map.size);

  return <div>Tile layer</div>;
}
