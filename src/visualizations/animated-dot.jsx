import React, { useState, useEffect } from 'react';
import {DeckGL} from '@deck.gl/react';
// import {TripsLayer} from '@deck.gl/geo-layers';
import AnimatedDotLayer from './animated-dot';

const INITIAL_VIEW_STATE = {
  longitude: -122.45,
  latitude: 37.8,
  zoom: 12,
  pitch: 0,
  bearing: 0,
};

export default function App() {
  const [time, setTime] = useState(0);
  const loopLength = 1800; // how long the trip runs (in timestamps)
  const animationSpeed = 1; // speed multiplier

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

  const layer = new AnimatedDotLayer({
    id: 'AnimatedDotLayer',
    data: [{ position: [-122.45, 37.8], size: 200 }],
    getPosition: (d) => d.position,
    getRadius: (d) => d.size,
    getFillColor: [255, 255, 255],
    radiusUnits: "meters",
    opacity: 0.9,
    currentTime: time,
  });

  return <DeckGL
    initialViewState={INITIAL_VIEW_STATE}
    controller
    layers={[layer]}
  />;
}