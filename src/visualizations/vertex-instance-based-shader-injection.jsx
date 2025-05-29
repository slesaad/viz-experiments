// import { createRoot } from 'react-dom/client';

import React, { useState, useEffect, useRef } from 'react';
import DeckGL from '@deck.gl/react';

import CircleLayer from './CircleLayer';

// log.priority = 3;

// Initial view state for the map
const INITIAL_VIEW_STATE = {
  longitude: -86.586,
  latitude: 34.73,
  zoom: 15,
  pitch: 0,
  bearing: 0
};


export default function Root() {
  const [data, setData] = useState([]);
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

  useEffect( () => {
    async function fetchData() {
    const d = await fetch('/assets/scatterplot-data-lonlat.json');

    const json = await d.json();
    setData(json);
    };
    fetchData();
  }, []);

  // Define layers
  const layers = [
    // Path layer for the flight trajectory
    // new TileLayer({
    //   data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    //   minZoom: 0,
    //   maxZoom: 19,
    //   tileSize: 256,
    //   renderSubLayers: props => {
    //     const { boundingBox: bbox, content: image } = props.tile;

    //     if (!image) return null;

    //     return new BitmapLayer(props, {
    //       data: null,
    //       image: image,
    //       bounds: [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]]
    //     })
    //   }
    // }),
    new CircleLayer({
      data,
      getPosition: d => d.position,
      getRadius: d => d.size,
      getFillColor: [255, 100, 100, 255],
      getShape: d => Math.floor(Math.random() * 3),
      fadeDistance: [200, 800],
      time: time,
    }),
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


/* global document */
// const container = document.body.appendChild(document.createElement('div'));
// createRoot(container).render(<Root />);
