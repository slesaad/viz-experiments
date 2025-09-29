import React, { useEffect, useState, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import {Tile3DLayer} from '@deck.gl/geo-layers';
import {ScatterplotLayer} from '@deck.gl/layers';
import {PolygonLayer} from '@deck.gl/layers';
import RippleLayer from './RippleLayer';
import {AmbientLight, DirectionalLight, LightingEffect} from '@deck.gl/core';


import {COORDINATE_SYSTEM} from '@deck.gl/core';


import {SimpleMeshLayer} from '@deck.gl/mesh-layers';
import {PlaneGeometry} from '@luma.gl/engine';


// Utility: generate a large rectangle around the center
function generateWaterPolygon(center, size = 0.1) {
  const [lng, lat] = center;
  return [
    [
      [lng - size, lat - size],
      [lng + size, lat - size],
      [lng + size, lat + size],
      [lng - size, lat + size]
    ]
  ];
}

// Create lights
const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 0.5 });
const directionalLight = new DirectionalLight({
  color: [255, 255, 255],
  intensity: 1.0,
  direction: [-1, -2, -3]
});

const lightingEffect = new LightingEffect({ambientLight, directionalLight});

const API_KEY = 'AIzaSyCI5F0OKjg2142wxh_Rthk7xNebhq8UdAk';
const BUILDINGS_URL = `https://tile.googleapis.com/v1/3dtiles/root.json`;

// Define your water plane size (in meters). You’ll likely make it large enough to cover the city area.
const WATER_WIDTH = 500000;  // meters east-west
const WATER_HEIGHT = 50000; // meters north-south
const WATER_ELEVATION = 0; // meters above ground


const centerLatitude = 25.7880796;
const centerLongitude = -80.2228099;


export default function Root() {

  const initialViewState = {
    longitude: centerLongitude,
    latitude: centerLatitude,
    zoom: 15,
    pitch: 50,
    bearing: 0,
  }

  const [time, setTime] = useState(0);


  // Animate time
  useEffect(() => {
    let animationFrame;
    const animate = () => {
      setTime(t => t + 0.016); // ~60fps
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, []);



  const [waterHeight, setWaterHeight] = useState(0);
  const [tilesOrigin, setTilesOrigin] = useState(null);

  const tiles3dlayer = new Tile3DLayer({
    id: 'google-3d-buildings',
    data: BUILDINGS_URL,
    loadOptions: {
      fetch: {
        headers: {
          'X-GOOG-API-KEY': API_KEY
        }
      }
    },
    onTilesetLoad: tileset => {
      const center = tileset.cartographicCenter; // [lng, lat, height]
      // You can now use this as coordinateOrigin
      setTilesOrigin(center);
    }
  })

  // const waterMesh = new PlaneGeometry({
  //     type: 'x,z',  // horizontal plane: X = east-west, Z = north-south
  //     xlen: WATER_WIDTH,   // width in meters
  //     zlen: WATER_HEIGHT,   // depth in meters
  //     nx: 2,        // subdivisions along X
  //     nz: 2,        // subdivisions along Z
  //     offset: 0     // height offset along Y axis (elevation)
  //   })

  // const waterLayer = tilesOrigin && waterMesh && new SimpleMeshLayer({
  //   id: 'water-layer',
  //   data: [{}], // just one mesh instance
  //   mesh: waterMesh,
  //   getPosition: [centerLongitude, centerLatitude, WATER_ELEVATION],
  //   getColor: [255, 255, 0, 255], //[30, 144, 255, 160], // semi-transparent blue
  //   getOrientation: [90, 0, 0], // rotate to lie flat
  //   coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
  //   coordinateOrigin: tilesOrigin,

  //   pickable: false,
  //   parameters: {
  //     depthTest: true, // ensures buildings above show correctly
  //     blend: true
  //   }
  // });

  const waterPolygon = [
    [
      [centerLongitude, centerLatitude],
      [centerLongitude - 0.2, centerLatitude],
      [centerLongitude - 0.2, centerLatitude + 0.2],
      [centerLongitude, centerLatitude + 0.2],
    ]
  ];

  const poly = new RippleLayer({
    id: 'water-layer',
    data: [{polygon: waterPolygon}],
    getPolygon: d => d.polygon,
    getElevation: () => waterHeight, // meters above ground
    extruded: true,
    getFillColor: [30, 144, 255, 120],
    uniforms: {uTime: time},
    updateTriggers: {
      getElevation: waterHeight, // ensures elevation updates every frame
      uniforms: time      // ensures shader uniform updates every frame
    },
    wireframe: false,
  });

  return (
    <>
      <DeckGL
        initialViewState={initialViewState}
        controller
        getTooltip={({ object }) =>
          object && object.position.join(', ')
        }
        layers={[ tiles3dlayer, poly]}
        effects={[lightingEffect]}  // <- add lighting
      />
      {/* Slider UI */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(255,255,255,0.9)',
        padding: '10px',
        borderRadius: '8px'
      }}>
        <label>Water Height: {waterHeight.toFixed(1)} meters</label>
        <input
          type="range"
          min={0}
          max={200}
          step={0.1}
          value={waterHeight}
          onChange={e => setWaterHeight(parseFloat(e.target.value))}
          style={{width: '200px'}}
        />
      </div>
    </>
  );
}

/* global document */
// const container = document.body.appendChild(document.createElement('div'));
// createRoot(container).render(<Root />);
