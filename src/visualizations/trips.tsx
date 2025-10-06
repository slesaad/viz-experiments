import React, { useState, useEffect } from 'react';
import {DeckGL} from '@deck.gl/react';
import {TripsLayer} from '@deck.gl/geo-layers';

type DataType = {
  waypoints: {
    coordinates: [longitude: number, latitude: number];
    timestamp: number;
  }[]
};

export default function App() {
  const [time, setTime] = useState(0);
  const loopLength = 1800; // how long the trip runs (in timestamps)
  const animationSpeed = 30; // speed multiplier

  // animate currentTime
  useEffect(() => {
    let frame;
    const animate = () => {
      setTime(t => (t + animationSpeed) % loopLength);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const layer = new TripsLayer<DataType>({
    id: 'TripsLayer',
    data: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/sf.trips.json',

    getPath: (d: DataType) => d.waypoints.map(p => p.coordinates),
    // Timestamp is stored as float32, do not return a long int as it will cause precision loss
    getTimestamps: (d: DataType) => d.waypoints.map(p => p.timestamp - 1554772579000),
    getColor: [253, 128, 93],
    currentTime: time,
    trailLength: 600,
    capRounded: true,
    jointRounded: true,
    widthMinPixels: 8
  });

  return <DeckGL
    initialViewState={{
      longitude: -122.4,
      latitude: 37.74,
      zoom: 11
    }}
    controller
    layers={[layer]}
  />;
}