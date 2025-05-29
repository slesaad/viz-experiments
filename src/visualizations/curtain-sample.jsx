import { createRoot } from 'react-dom/client';

import React, { useState, useEffect, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer} from '@deck.gl/geo-layers';
import { BitmapLayer, ScatterplotLayer, PointCloudLayer} from '@deck.gl/layers';


import { AmbientLight, DirectionalLight, LightingEffect } from '@deck.gl/core';
import { COORDINATE_SYSTEM } from '@deck.gl/core';


const curtainData = [];
const startLon = -90;    // Starting longitude
const endLon = -89.5;    // Ending longitude (creates a large width)
const startLat = 29.9;   // Starting latitude
const endLat = 30.1;     // Ending latitude (adds vertical coverage)

const spacing = 10; // Vertical spacing (adjustable)

let value = 1.0; // Value for color intensity, can adjust based on preference

// Populate curtainData with dense lat/lon values
for (let lon = startLon; lon <= endLon; lon += 0.01) { // Small step for horizontal density
  for (let lat = startLat; lat <= endLat; lat += 0.01) { // Small step for vertical density
    curtainData.push({
      lat: lat,
      lon: lon,
      base: 0,
      top: 15000, // Height of the curtain
      value: value
    });
    value -= 0.1; // Gradual change in value for a color gradient (adjust as needed)
    if (value < 0) value = 1.0; // Reset value for color
  }
}

// Generate denser points for the vertical curtain
function generateCurtainPoints(data) {
  const points = [];
  const horizontalOffset = 0.001; // Much smaller horizontal offset for denser spread

  data.forEach((d, i) => {
    const steps = Math.floor((d.top - d.base) / spacing);  // More vertical points
    for (let j = 0; j <= steps; j++) {
      points.push({
        position: [
          d.lon + i * horizontalOffset,        // Adjust longitude offset for wide coverage
          d.lat,                               // Keep latitude constant
          d.base + j * spacing                 // Vertical spacing (altitude)
        ],
        color: [255 * d.value, 50, 255 * (1 - d.value)]   // Color based on value
      });
    }
  });

  return points;
}

const points = generateCurtainPoints(curtainData);
console.log(points)

const CurtainPointCloud = new PointCloudLayer({
  id: 'curtain-pointcloud',
  data: points,
  coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
  getPosition: d => d.position,
  getColor: d => d.color,
  pointSize: 50,
  pickable: true,
  sizeUnits: 'meters'
});

export default function Root() {
  const INITIAL_VIEW_STATE = {
    longitude: -89.5,
    latitude: 30,
    zoom: 10,   // Increase zoom level to focus on the region
    pitch: 75,  // Increase pitch for a better angle
    bearing: 0
  };


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

        return new BitmapLayer(props, {
          data: null,
          image: image,
          bounds: [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]]
        })
      }
    }),
    CurtainPointCloud
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
