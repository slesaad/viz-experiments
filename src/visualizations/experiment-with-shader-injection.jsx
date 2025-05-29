import { createRoot } from 'react-dom/client';

import React, { useState, useEffect, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
// import {log} from '@deck.gl/core';

import PulsingScatterplotLayer from './PulsingScatterplotLayer';
import ContrastBitmapLayer from './ContrastBitmapLayer';

// log.priority = 3;

// Initial view state for the map
const INITIAL_VIEW_STATE = {
  longitude: -122.45,
  latitude: 37.75,
  zoom: 10,
  pitch: 0,
  bearing: 0
};

const data = [
  {coordinates: [-122.4, 37.8]},
  {coordinates: [-122.5, 37.7]},
];

// const FIX_MODEL_ROTATION = new Matrix4().rotateZ(180).rotateX(360); // Rotate 90° clockwise around Z
// orientation: [position.Pitch_Angle, position.True_Heading, position.Roll_Angle]


export default function Root() {
  const [time, setTime] = useState(0);
  const animationRef = useRef();
  const startRef = useRef(Date.now());

  // Update time every frame
  useEffect(() => {
    const animate = () => {
      const elapsed = (Date.now() - startRef.current) / 1000; // in seconds
      setTime(parseFloat(elapsed));
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  const scatterLayer = new PulsingScatterplotLayer({
    id: `pulse-glow-scatter-${Math.floor(time * 1000)}`,
    data,
    getPosition: d => d.coordinates,
    getRadius: 800,
    radiusUnits: 'meters',
    getFillColor: [255, 100, 100],
    time: 0.9,
    updateTriggers: {
      getRadius: [time], // force rerender if needed
      getFillColor: [time],
    }
  });

  // Define layers
  const layers = [
    // Path layer for the flight trajectory
    new TileLayer({
      data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: props => {
        const { boundingBox: bbox, content: image } = props.tile;

        if (!image) return null;

        return new ContrastBitmapLayer(props, {
          data: null,
          image: image,
          bounds: [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]],
          brightness: -0.9,
          contrast: 1.5,
        })
      }
    }),
    scatterLayer,
  ];

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
      >
      </DeckGL>
    </div>
  );
}


// /* global document */
// const container = document.body.appendChild(document.createElement('div'));
// createRoot(container).render(<Root />);
