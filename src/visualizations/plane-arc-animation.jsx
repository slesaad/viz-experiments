// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import React, { useState, useEffect, useMemo } from 'react';
import {createRoot} from 'react-dom/client';

import DeckGL from '@deck.gl/react';
import { ArcLayer, IconLayer, ScatterplotLayer } from '@deck.gl/layers';
import { FlyToInterpolator } from '@deck.gl/core';
import { easeCubic } from 'd3-ease';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';

// Coordinates for Atlanta (ATL) and Kathmandu (KTM)
const ATL = [-84.428, 33.6367]; // [longitude, latitude]
const KTM = [85.3659, 27.6994];

// Create a flight path between the two airports
const generateFlightPath = () => {
  const points = [];
  const steps = 100;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lon = ATL[0] * (1 - t) + KTM[0] * t;
    const lat = ATL[1] * (1 - t) + KTM[1] * t;
    points.push([lon, lat]);
  }
  
  return {
    points,
    arc: {
      source: ATL,
      target: KTM
    }
  };
};

// SVG for plane icon
const PLANE_ICON = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21,16V14L13,9V3.5A1.5,1.5,0,0,0,11.5,2A1.5,1.5,0,0,0,10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z" fill="white"/>
</svg>
`;

export default function Root() {
  // Debug state
  const [debug, setDebug] = useState({
    planePos: [0, 0],
    timeValue: 0,
    frameCount: 0
  });

  // Initial view state
  const initialViewState = {
    longitude: 0,
    latitude: 30,
    zoom: 1.5,
    pitch: 30,
    bearing: 0
  };

  const [viewState, setViewState] = useState(initialViewState);
  
  // Animation state - using a ref for smoother animation
  const timeRef = React.useRef(0);
  const [flightInfo, setFlightInfo] = useState("Preparing for takeoff...");
  
  // Generate flight path once
  const flightPath = useMemo(() => generateFlightPath(), []);

  // Calculate current plane position and angle
  const planeData = useMemo(() => {
    const time = timeRef.current;
    const index = Math.min(Math.floor(time * (flightPath.points.length - 1)), flightPath.points.length - 2);
    const position = flightPath.points[index];
    
    // Calculate direction for plane rotation
    const nextPoint = flightPath.points[index + 1];
    const angle = Math.atan2(
      nextPoint[1] - position[1], 
      nextPoint[0] - position[0]
    ) * 180 / Math.PI;
    
    setDebug(prev => ({ 
      ...prev, 
      planePos: position,
      timeValue: time,
      frameCount: prev.frameCount + 1
    }));
    
    return [{
      position,
      angle
    }];
  }, [flightPath, timeRef.current]);

  // Animation effect with explicit RAF handling
  useEffect(() => {
    let animationFrameId;
    const animationDuration = 30000; // 30 seconds
    const startTime = Date.now();
    
    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Update time ref for smoother animation
      timeRef.current = progress;
      
      // Update flight info
      if (progress < 0.1) {
        setFlightInfo("Departing from Atlanta (ATL)");
      } else if (progress > 0.9) {
        setFlightInfo("Approaching Kathmandu (KTM)");
      } else {
        const distanceTraveled = Math.floor(progress * 100);
        setFlightInfo(`En route: ${distanceTraveled}% complete`);
      }
      
      // Update camera to follow plane
      if (progress > 0.05 && progress < 0.95) {
        const index = Math.min(Math.floor(progress * flightPath.points.length), flightPath.points.length - 1);
        const position = flightPath.points[index];
        
        setViewState({
          longitude: position[0],
          latitude: position[1],
          zoom: 3,
          pitch: 45,
          bearing: 0,
          transitionDuration: 0  // Smoother camera following
        });
      }

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // End of animation
        setViewState({
          longitude: KTM[0],
          latitude: KTM[1],
          zoom: 5,
          pitch: 30,
          bearing: 0,
          transitionDuration: 2000,
          transitionInterpolator: new FlyToInterpolator(),
          transitionEasing: easeCubic
        });
        setFlightInfo("Arrived at Kathmandu (KTM)");
      }
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [flightPath.points]);

  // Define layers
  const layers = [
    // Base map layer - properly configured TileLayer
    new TileLayer({
      data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: props => {
        const {
          bbox: {west, south, east, north}
        } = props.tile;

        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [west, south, east, north]
        });
      }
    }),

    // Arc layer for the flight path
    new ArcLayer({
      id: 'flight-path',
      data: [flightPath.arc],
      pickable: true,
      getWidth: 5,
      widthMinPixels: 2,
      getSourcePosition: d => d.source,
      getTargetPosition: d => d.target,
      getSourceColor: [0, 128, 255],
      getTargetColor: [255, 0, 128]
    }),

    // Airport markers
    new ScatterplotLayer({
      id: 'airports',
      data: [
        { position: ATL, name: 'ATL' },
        { position: KTM, name: 'KTM' }
      ],
      pickable: true,
      stroked: true,
      filled: true,
      radiusScale: 10,
      radiusMinPixels: 8,
      getPosition: d => d.position,
      getRadius: 10,
      getFillColor: [255, 140, 0],
      getLineColor: [0, 0, 0]
    }),

    // Plane icon
    new IconLayer({
      id: 'plane',
      data: planeData,
      pickable: true,
      sizeScale: 3,
      sizeMinPixels: 24,
      getPosition: d => d.position,
      getIcon: () => ({
        url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PLANE_ICON)}`,
        width: 128,
        height: 128,
        anchorX: 64,
        anchorY: 64
      }),
      getSize: 20,
      getColor: [255, 255, 255],
      getAngle: d => d.angle
    })
  ];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <DeckGL
        layers={layers}
        initialViewState={initialViewState}
        viewState={viewState}
        onViewStateChange={evt => setViewState(evt.viewState)}
        controller={true}
      />

      {/* Flight info overlay */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        padding: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 4,
        zIndex: 10
      }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Flight: ATL to KTM</h3>
        <div>{flightInfo}</div>
        <div style={{ marginTop: '5px' }}>Progress: {Math.floor(timeRef.current * 100)}%</div>

        {/* Debug info - hidden in production */}
        <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
          Plane: [{debug.planePos[0].toFixed(2)}, {debug.planePos[1].toFixed(2)}]
          <br/>Time: {debug.timeValue.toFixed(3)}
          <br/>Frames: {debug.frameCount}
        </div>
      </div>
    </div>
  );
}

/* global document */
// const container = document.body.appendChild(document.createElement('div'));
// createRoot(container).render(<Root />);