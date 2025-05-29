import { createRoot } from 'react-dom/client';

import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { BitmapLayer, PathLayer, PointCloudLayer, ScatterplotLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { COORDINATE_SYSTEM } from '@deck.gl/core';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';

// import { Map } from 'react-map-gl';
// import MapGL from '@urbica/react-map-gl';
import { scaleLinear } from 'd3-scale';

// Initial view state for the map
const INITIAL_VIEW_STATE = {
  longitude: -122.4,
  latitude: 37.74,
  zoom: 14,
  pitch: 60,
  bearing: 0,
  minZoom: 5,
  maxZoom: 20
};

const MODEL_URL = '/assets/ER2_AFRC_IMPACTS_AIR_0824.glb';


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

// Process flight data into points for visualization
const processDataForPointCloud = (data, currentTime, colorScale) => {
  // Filter data points up to the current time
  const visiblePoints = data.filter(point => point.timestamp <= currentTime);
  
  if (visiblePoints.length === 0) return [];
  
  const interpolateMeasurements = (start, end, steps) => {
    const interpolated = [];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      interpolated.push({
        longitude: start.longitude + t * (end.longitude - start.longitude),
        latitude: start.latitude + t * (end.latitude - start.latitude),
        height: start.height + t * (end.height - start.height),
        value: start.value + t * (end.value - start.value)
      });
    }
    return interpolated;
  };

  const interpolateInHeight = (measurement, steps) => {
    const interpolated = [];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      interpolated.push({
        longitude: measurement.longitude,
        latitude: measurement.latitude,
        height: measurement.height - t * 50, // Interpolate downward in height
        value: measurement.value
      });
    }
    return interpolated;
  };

  // Extract all measurement points and interpolate between them
  const points = visiblePoints.flatMap((point, index) => {
    const nextPoint = visiblePoints[index + 1];
    const measurements = point.measurements.flatMap(m => {
      const basePoint = {
        position: [m.longitude, m.latitude, m.height],
        color: [...colorScale(m.value), 255],
        value: m.value
      };
      const heightInterpolated = interpolateInHeight(m, 10).map(interpolatedPoint => ({
        position: [interpolatedPoint.longitude, interpolatedPoint.latitude, interpolatedPoint.height],
        color: [...colorScale(interpolatedPoint.value), 255],
        value: interpolatedPoint.value
      }));
      return [basePoint, ...heightInterpolated];
    });

    if (nextPoint) {
      const interpolated = point.measurements.flatMap((m, i) => {
        const nextMeasurement = nextPoint.measurements[i];
        const interpolatedMeasurements = interpolateMeasurements(m, nextMeasurement, 100);
        return interpolatedMeasurements.flatMap(interpolatedPoint => {
          const heightInterpolated = interpolateInHeight(interpolatedPoint, 10).map(heightPoint => ({
            position: [heightPoint.longitude, heightPoint.latitude, heightPoint.height],
            color: [...colorScale(heightPoint.value), 255],
            value: heightPoint.value
          }));
          return heightInterpolated;
        });
      });
      return [...measurements, ...interpolated];
    }

    return measurements;
  });

  return points;
};

export default function Root() {
  const [flightData] = useState(generateFlightData());
  const [currentTime, setCurrentTime] = useState(0);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [pointCloudData, setPointCloudData] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [colorScale, setColorScale] = useState(() => generateColorScale(flightData));
  const maxTime = flightData[flightData.length - 1].timestamp;


  // Prepare visible flight path based on current time
  const interpolateFlightPath = (start, end, steps) => {
    const interpolated = [];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      interpolated.push({
        position: [
          start.longitude + t * (end.longitude - start.longitude),
          start.latitude + t * (end.latitude - start.latitude),
          start.altitude + t * (end.altitude - start.altitude)
        ],
        timestamp: start.timestamp + t * (end.timestamp - start.timestamp),
        heading: -90
      });
    }
    return interpolated;
  };

  const visiblePath = flightData
    .filter(point => point.timestamp <= currentTime)
    .flatMap((point, index, array) => {
      const nextPoint = array[index + 1];
      if (nextPoint) {
        return [
          {
            position: [point.longitude, point.latitude, point.altitude],
            timestamp: point.timestamp,
            heading: -90
          },
          ...interpolateFlightPath(point, nextPoint, 10)
        ];
      }
      return {
        position: [point.longitude, point.latitude, point.altitude],
        timestamp: point.timestamp,
        heading: -90
      };
    });

  // Update view to follow aircraft
  useEffect(() => {

    const currentAircraftPosition = visiblePath.length > 0 ? visiblePath[visiblePath.length - 1] : null;
    if (currentAircraftPosition) {
      setViewState(prev => ({
        ...prev,
        longitude: currentAircraftPosition.position[0],
        latitude: currentAircraftPosition.position[1]+0.006
      }));
    }
  }, [currentTime, flightData]);
  
  // Update point cloud data when time changes
  useEffect(() => {
    const newPointData = processDataForPointCloud(flightData, currentTime, colorScale);
    setPointCloudData(newPointData);
  }, [currentTime, flightData, colorScale]);
  
  // Animation logic
  useEffect(() => {
    let animationFrame;
    const animationSpeed = 300; // Adjust this value for slower animation (milliseconds per frame)
    
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
        animationFrame = setTimeout(() => requestAnimationFrame(animate), animationSpeed);
      }
    };
    
    if (isPlaying) {
      animationFrame = setTimeout(() => requestAnimationFrame(animate), animationSpeed);
    }
    
    return () => {
      if (animationFrame) {
        clearTimeout(animationFrame);
      }    };
  }, [isPlaying, maxTime]);
  
  // Get current aircraft position
  const currentAircraftPosition = visiblePath.length > 0 ? 
    visiblePath[visiblePath.length - 1] : null;
  
  // Define layers
  const layers = [
    // The measurement curtain
    new PointCloudLayer({
      id: 'measurement-points',
      data: pointCloudData,
      getPosition: d => d.position,
      getColor: d => d.color,
      pointSize: 3,
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      pickable: true
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
      getColor: [255, 0, 0],
      widthMinPixels: 2,
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT
    }),
    
    // 3D aircraft model using ScenegraphLayer
    new ScenegraphLayer({
      id: 'aircraft-model',
      data: currentAircraftPosition ? [currentAircraftPosition] : [],
      scenegraph: MODEL_URL,
      getPosition: d => d.position,
      getOrientation: d => [0, -d.heading, 90], // Adjust rotations to match model orientation
      sizeScale: 1000, // Adjust based on your model's scale
      _lighting: 'pbr', // Use physically based rendering
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT
    })
  ];
  
  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        viewState={viewState}
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
        color: 'black',
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
      </div>
    </div>
  );
}


/* global document */
// const container = document.body.appendChild(document.createElement('div'));
// createRoot(container).render(<Root />);
