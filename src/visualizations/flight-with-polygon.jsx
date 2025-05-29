import { createRoot } from 'react-dom/client';

import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { BitmapLayer, PathLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { COORDINATE_SYSTEM } from '@deck.gl/core';
// import { Map } from 'react-map-gl';
// import MapGL from '@urbica/react-map-gl';
import { scaleLinear } from 'd3-scale';

// Initial view state for the map
const INITIAL_VIEW_STATE = {
  longitude: -122.4,
  latitude: 37.74,
  zoom: 11,
  pitch: 60,
  bearing: 0,
  minZoom: 5,
  maxZoom: 20
};

// Example flight data with time and measurements
const generateFlightData = () => {
  const flightPath = [];
  const numPoints = 100;

  // Generate a sample flight path
  for (let i = 0; i < numPoints; i++) {
    const longitude = -122.4 + (i * 0.008);
    const latitude = 37.74 + (Math.sin(i / 10) * 0.02);
    const altitude = 500 + (Math.sin(i / 5) * 100);

    // Generate measurements at different heights below the flight
    const measurements = [];
    for (let h = 0; h < 10; h++) {
      // Measurement height decreases as we go down
      const measHeight = altitude - ((h + 1) * 50);
      
      // Generate some sample measurement value that varies with position and height
      const value = 50 + (Math.sin(i / 8) * 20) + (Math.cos(h / 2) * 15);
      
      measurements.push({
        longitude,
        latitude,
        height: measHeight,
        value
      });
    }

    flightPath.push({
      longitude,
      latitude,
      altitude,
      timestamp: i * 60, // seconds since start
      measurements
    });
  }
  
  return flightPath;
};

// Generate color scale for measurement values
const generateColorScale = (data) => {
  // Extract all measurement values
  const allValues = data.flatMap(point => 
    point.measurements.map(m => m.value)
  );
  
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  
  return scaleLinear()
    .domain([minValue, (minValue + maxValue) / 2, maxValue])
    .range([[0, 0, 255], [0, 255, 0], [255, 0, 0]]);
};

// Function to create curtain polygons from the flight data
const createCurtainPolygons = (data, currentTime) => {
  // Filter data points up to the current time
  const visiblePoints = data.filter(point => point.timestamp <= currentTime);
  
  if (visiblePoints.length < 2) return [];
  
  const polygons = [];
  const colorScale = generateColorScale(data);

  // Create a polygon for each segment between measurements
  for (let i = 0; i < visiblePoints.length - 1; i++) {
    const point1 = visiblePoints[i];
    const point2 = visiblePoints[i + 1];
    
    // Create "curtain" between each measurement level
    for (let j = 0; j < 9; j++) {  // 9 segments between 10 measurement heights
      const meas1A = point1.measurements[j];
      const meas1B = point1.measurements[j + 1];
      const meas2A = point2.measurements[j];
      const meas2B = point2.measurements[j + 1];
      
      // Average value for coloring
      const avgValue = (meas1A.value + meas1B.value + meas2A.value + meas2B.value) / 4;
      const color = colorScale(avgValue);
      
      // Create a quad (2 triangles) to form the curtain segment
      polygons.push({
        polygon: [
          [meas1A.longitude, meas1A.latitude, meas1A.height],
          [meas1B.longitude, meas1B.latitude, meas1B.height],
          [meas2B.longitude, meas2B.latitude, meas2B.height],
          [meas2A.longitude, meas2A.latitude, meas2A.height]
        ],
        color: [...color, 180], // Add alpha channel
        value: avgValue
      });
    }
  }
  
  return polygons;
};

export default function Root() {
  const [flightData] = useState(generateFlightData());
  const [currentTime, setCurrentTime] = useState(0);
  const [curtainPolygons, setCurtainPolygons] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const maxTime = flightData[flightData.length - 1].timestamp;
  
  // Update curtain polygons when time changes
  useEffect(() => {
    const newPolygons = createCurtainPolygons(flightData, currentTime);
    setCurtainPolygons(newPolygons);
  }, [currentTime, flightData]);
  
  // Animation logic
  useEffect(() => {
    let animationFrame;
    
    const animate = () => {
      if (isPlaying) {
        setCurrentTime(prevTime => {
          const newTime = prevTime + 60; // Advance by 60 seconds
          if (newTime >= maxTime) {
            setIsPlaying(false);
            return maxTime;
          }
          return newTime;
        });
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    if (isPlaying) {
      animationFrame = requestAnimationFrame(animate);
    }
    
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [isPlaying, maxTime]);
  
  // Prepare visible flight path based on current time
  const visiblePath = flightData
    .filter(point => point.timestamp <= currentTime)
    .map(point => ({
      position: [point.longitude, point.latitude, point.altitude],
      timestamp: point.timestamp
    }));
  
  // Define layers
  const layers = [
    // The measurement curtain
    new PolygonLayer({
      id: 'measurement-curtain',
      data: curtainPolygons,
      getPolygon: d => d.polygon,
      getFillColor: d => d.color,
      getLineColor: [80, 80, 80],
      getLineWidth: 1,
      extruded: true,
      wireframe: true,
      pickable: true,
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      material: {
        ambient: 0.64,
        diffuse: 0.6,
        shininess: 32,
        specularColor: [51, 51, 51]
      }
    }),
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
          image: props.data,
          bounds: [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]]
        })
      }
    }),
    new PathLayer({
      id: 'flight-path',
      data: [visiblePath],
      getPath: d => d.map(p => p.position),
      getWidth: 5,
      getColor: [255, 255, 255],
      widthMinPixels: 2,
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT
    }),
    
    // Aircraft position
    new ScatterplotLayer({
      id: 'aircraft',
      data: visiblePath.length > 0 ? [visiblePath[visiblePath.length - 1]] : [],
      getPosition: d => d.position,
      getRadius: 100,
      getFillColor: [255, 0, 0],
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT
    })
  ];
  
  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
      >
        {/* <MapGL
          mapStyle="mapbox://styles/mapbox/dark-v10" 
          mapboxAccessToken="pk.eyJ1IjoiY292aWQtbmFzYSIsImEiOiJjbGNxaWdqdXEwNjJnM3VuNDFjM243emlsIn0.NLbvgae00NUD5K64CD6ZyA"
        /> */}
      </DeckGL>
      
      {/* Time control UI */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        padding: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        borderRadius: 4
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            style={{ marginRight: 10 }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <input
            type="range"
            min={0}
            max={maxTime}
            value={currentTime}
            onChange={e => {
              setCurrentTime(parseInt(e.target.value, 10));
              setIsPlaying(false);
            }}
            style={{ flex: 1 }}
          />
        </div>
        <div>
          Time: {Math.floor(currentTime / 60)} minutes
        </div>
      </div>
      
      {/* Legend */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        padding: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        borderRadius: 4
      }}>
        <div style={{ marginBottom: 5 }}>Measurement Value</div>
        <div style={{ 
          width: '100%', 
          height: 20, 
          background: 'linear-gradient(to right, rgb(0,0,255), rgb(0,255,0), rgb(255,0,0))'
        }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      {/* Added instructions panel */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        padding: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        borderRadius: 4,
        maxWidth: 300
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Flight Path Curtain Visualization</h3>
        <p>This visualization shows a flight path with a vertical curtain of measurements beneath it.</p>
        <p><strong>Controls:</strong><br/>
        • Drag to rotate<br/>
        • Scroll to zoom<br/>
        • Shift+drag to pan</p>
      </div>
    </div>
  );
}


/* global document */
// const container = document.body.appendChild(document.createElement('div'));
// createRoot(container).render(<Root />);
