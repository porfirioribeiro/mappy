import React, { useState } from 'react';
import './App.css';
import { Map, TileLayer } from '../react';

function App() {
  return (
    <div className="App">
      <h6>Map</h6>
      <Map className="map">
        <TileLayer />
      </Map>
    </div>
  );
}

export default App;
