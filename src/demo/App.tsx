import React, { useState } from 'react';
import './App.css';
import { Map, TileLayer } from '../react';
import { gmapsTileProvider, osmTileProvider } from '../core';

function App() {
  return (
    <div className="App">
      <h6>Map</h6>
      <Map className="map" defaultCenter={[38, -8]} defaultZoom={4}>
        <TileLayer provider={gmapsTileProvider} />
      </Map>
    </div>
  );
}

export default App;
