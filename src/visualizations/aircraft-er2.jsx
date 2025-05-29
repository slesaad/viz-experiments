import { createRoot } from 'react-dom/client';

import React, { useState, useEffect, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { BitmapLayer, PathLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { COORDINATE_SYSTEM } from '@deck.gl/core';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { parse } from 'papaparse';
import { Matrix4 } from '@math.gl/core';


// Initial view state for the map
const INITIAL_VIEW_STATE = {
  longitude: -84.503,
  latitude: 33.91,
  zoom: 16,
  pitch: 60,
  bearing: 0,
  minZoom: 5,
  maxZoom: 20
};

const MODEL_URL = '/assets/ER2_AFRC_IMPACTS_AIR_0824.glb';

// const FIX_MODEL_ROTATION = new Matrix4().rotateZ(180).rotateX(360); // Rotate 90° clockwise around Z
// orientation: [position.Pitch_Angle, position.True_Heading, position.Roll_Angle]


export default function Root() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [data, setData] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

   // Load the actual data file
   useEffect(() => {
    const loadFlightData = async () => {
      try {
        // Fetch the data file
        const response = await fetch('/assets/IMPACTS_MetNav_ER2_20230302_R0.ict');
        const text = await response.text();
        const logs = text.split('\n').slice(56).join('\n');

        // Parse the CSV data
        const result = parse(logs, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });

        if (result.data && result.data.length) {
          setData(result.data);
        }
      } catch (error) {
        console.error('Error loading flight data:', error);
      }
    };

    loadFlightData();
  }, []);


  // Animation logic
  useEffect(() => {
    let animationFrame;
    const animationSpeed = 50; // Adjust this value for slower animation (milliseconds per frame)

    if (isPlaying && data.length > 0) {
      const animate = () => {
        setCurrentTime(prevTime => {
          const nextTime = prevTime + 1;
          return nextTime >= data.length ? 0 : nextTime;
        });
        animationFrame = setTimeout(() => requestAnimationFrame(animate), animationSpeed);
      };

      animationFrame = setTimeout(() => requestAnimationFrame(animate), animationSpeed);
    }
    return () => {
      if (animationFrame) {
        clearTimeout(animationFrame);
      }
    };
  }, [isPlaying, data]);

  // Update view to follow aircraft
  useEffect(() => {
    if (data.length > 0 && currentTime < data.length) {
      const currentPosition = data[currentTime];
      setViewState(prev => ({
        ...prev,
        longitude: currentPosition.Longitude,
        latitude: currentPosition.Latitude
      }));
    }
  }, [currentTime, data]);

  // Create path data for PathLayer
  const pathData = useMemo(() => {
    if (!data.length) return [];
    return [{
      path: data.map(d => [d.Longitude, d.Latitude, d.GPS_Altitude / 100]), // Scale altitude for visualization
      color: [255, 0, 0]
    }];
  }, [data]);

  // Prepare current position for ScenegraphLayer
  const currentPosition = useMemo(() => {
    if (!data.length || currentTime >= data.length) return {
      position: [0, 0, 0],
      orientation: [0, 90, 0]
    };
    const position = data[currentTime];
    return {
      position: [position.Longitude, position.Latitude, position.GPS_Altitude / 100],
      orientation: [ position.Pitch_Angle + 0, position.True_Heading + 0, position.Roll_Angle + 70]
      // orientation: [0, currentTime * 0.1, 0]
    };
  }, [data, currentTime]);

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
          image: props.data,
          bounds: [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]]
        })
      }
    }),
    new PathLayer({
      id: 'flight-path',
      data: pathData,
      getPath: d => d.path,
      getWidth: 5,
      getColor: d => d.color,
      widthMinPixels: 2,
      widthUnits: 'pixels',
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT
    }),

    // 3D aircraft model using ScenegraphLayer
    new ScenegraphLayer({
      id: 'aircraft-model',
      data: [currentPosition],
      scenegraph: MODEL_URL,
      getPosition: d => d.position,
      // getOrientation: d => d.orientation,
      sizeScale: 300, // Adjust based on your model's scale
      _lighting: 'pbr', // Use physically based rendering
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      getTransformMatrix: d => {
        return new Matrix4()
          // apply yaw (heading) first around Z
          .rotateZ((d.orientation[1] || 0) * Math.PI / 180)
          // then pitch around Y
          .rotateY((d.orientation[0] || 0) * Math.PI / 180)
          // then roll around X
          .rotateX((d.orientation[2] || 0) * Math.PI / 180);
      }
    })
  ];

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        viewState={viewState}
      >
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
            max={data.length - 1}
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
