import { useState, useEffect, useMemo, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { generateFakeVelocityField } from './velocity-field';
import { generateCO2VelocityField, getCO2Metadata, sampleCO2AtNormalizedPosition, getCO2Range } from './co2-velocity-field.ts';
import { generateWindVelocityField, getWindMetadata, sampleWindAtNormalizedPosition, getWindSpeedRange } from './wind-velocity-field.ts';
import { ParticleSystem } from './particle-system';
import ParticleAdvectionLayer from './ParticleAdvectionLayer';

// Initial view state for the map
const INITIAL_VIEW_STATE = {
  longitude: -98,
  latitude: 39,
  zoom: 4.5,
  pitch: 0,
  bearing: 0,
  minZoom: 3,
  maxZoom: 20
};

// Bounds for the visualization - entire continental US
const VISUALIZATION_BOUNDS = {
  west: -125,   // West coast
  south: 24,    // Southern tip of Florida
  east: -66,    // East coast
  north: 49,    // Canadian border
};

// Velocity field resolution
const FIELD_WIDTH = 128;
const FIELD_HEIGHT = 128;

export default function ParticleAdvectionVisualization() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [time, setTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [particleSize, setParticleSize] = useState(2.5);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [colorBy, setColorBy] = useState('co2'); // 'co2' or 'wind' - what to color particles by
  const [numParticles, setNumParticles] = useState(10000);

  const particleSystemRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());

  // Initialize and recreate particle system when particle count changes
  useEffect(() => {
    particleSystemRef.current = new ParticleSystem({
      numParticles: numParticles,
      bounds: VISUALIZATION_BOUNDS,
      minAge: 50,
      maxAge: 150,
      speedMultiplier,
    });
  }, [numParticles]);

  // Update speed multiplier
  useEffect(() => {
    if (particleSystemRef.current) {
      particleSystemRef.current.speedMultiplier = speedMultiplier;
    }
  }, [speedMultiplier]);

  // Animation loop
  useEffect(() => {
    if (isPaused) return;

    const animate = () => {
      const now = Date.now();
      const dt = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      setTime(t => t + dt);
      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isPaused]);

  // Generate velocity field and update particles
  const particleData = useMemo(() => {
    if (!particleSystemRef.current) {
      return [];
    }

    // Always use wind for particle movement
    const velocityField = generateWindVelocityField(
      FIELD_WIDTH,
      FIELD_HEIGHT,
      VISUALIZATION_BOUNDS
    );

    // Sample the value for coloring based on colorBy setting
    let sampleFn;
    if (colorBy === 'wind') {
      // Color by wind speed
      sampleFn = (x, y) => {
        const wind = sampleWindAtNormalizedPosition(x, y, VISUALIZATION_BOUNDS);
        return wind.speed;
      };
    } else {
      // Color by CO2 concentration
      sampleFn = (x, y) => sampleCO2AtNormalizedPosition(x, y, VISUALIZATION_BOUNDS);
    }

    // Update particle system with wind velocity and appropriate color sampling
    particleSystemRef.current.update(velocityField, 16, sampleFn);

    // Get raw data
    const positions = particleSystemRef.current.getPositions();
    const ages = particleSystemRef.current.getAges();
    const colorValues = particleSystemRef.current.getCO2Values(); // Actually holds either CO2 or wind speed

    // Convert to data array with accessor-friendly format
    const data = [];
    for (let i = 0; i < ages.length; i++) {
      data.push({
        position: [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]],
        age: ages[i],
        co2: colorValues[i], // This will hold either CO2 or wind speed depending on colorBy
      });
    }

    return data;
  }, [time, colorBy]);

  // Get value range for color mapping based on colorBy setting
  const valueRange = useMemo(() => {
    if (colorBy === 'wind') {
      return getWindSpeedRange();
    }
    return getCO2Range();
  }, [colorBy]);

  // Create particle layer
  const particleLayer = useMemo(() => {
    // Different color scales for different color modes
    const colorScale = colorBy === 'wind'
      ? [
          [0.4, 0.7, 1.0],  // Low wind - Light Blue
          [0.3, 0.9, 0.6],  // Medium-low wind - Cyan/Green
          [0.9, 0.9, 0.3],  // Medium-high wind - Yellow
          [1.0, 0.4, 0.2],  // High wind - Red
        ]
      : [
          [0.1, 0.4, 0.8],  // Low CO2 - Blue
          [0.3, 0.7, 0.5],  // Medium CO2 - Green
          [0.9, 0.9, 0.2],  // High CO2 - Yellow
          [1.0, 0.3, 0.1],  // Very High CO2 - Red
        ];

    return new ParticleAdvectionLayer({
      id: 'particle-advection',
      data: particleData,
      getPosition: d => d.position,
      getAge: d => d.age,
      getCO2: d => d.co2,
      particleSize,
      fadeOpacity: 0.5,
      time: time / 1000,
      co2Range: valueRange,
      colorScale,
    });
  }, [particleData, particleSize, time, valueRange, colorBy]);

  // Free basemap layer (CartoDB Dark Matter)
  const basemapLayer = useMemo(() => {
    return new TileLayer({
      data: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', //'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
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
    });
  }, []);

  const layers = [basemapLayer, particleLayer];

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        controller={true}
        layers={layers}
      />

      {/* Control Panel */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(0, 0, 0, 0.85)',
        padding: '20px',
        borderRadius: '8px',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        minWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>
          Wind Flow Visualization
        </h3>

        {/* Color By Toggle */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '15px',
        }}>
          <button
            onClick={() => setColorBy('co2')}
            style={{
              flex: 1,
              padding: '10px',
              background: colorBy === 'co2' ? '#2196F3' : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: colorBy === 'co2' ? 'bold' : 'normal',
              transition: 'all 0.2s',
            }}
          >
            Color by CO2
          </button>
          <button
            onClick={() => setColorBy('wind')}
            style={{
              flex: 1,
              padding: '10px',
              background: colorBy === 'wind' ? '#2196F3' : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: colorBy === 'wind' ? 'bold' : 'normal',
              transition: 'all 0.2s',
            }}
          >
            Color by Wind
          </button>
        </div>

        {/* Status */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '15px',
          fontSize: '13px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Particles:</strong>
            <span style={{ color: '#4CAF50', marginLeft: '8px' }}>
              {numParticles.toLocaleString()}
            </span>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Status:</strong>
            <span style={{ color: isPaused ? '#FFB74D' : '#4CAF50', marginLeft: '8px' }}>
              {isPaused ? 'Paused' : 'Running'}
            </span>
          </div>
        </div>

        {/* Pause/Resume Button */}
        <button
          onClick={() => setIsPaused(!isPaused)}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '15px',
            background: isPaused ? '#4CAF50' : '#FF9800',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        {/* Particle Size Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Particle Size: {particleSize.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={particleSize}
            onChange={(e) => setParticleSize(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Speed Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Speed: {speedMultiplier.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={speedMultiplier}
            onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Particle Count Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Particle Count: {numParticles.toLocaleString()}
            {numParticles > 50000 && <span style={{ color: '#FFB74D', fontSize: '11px' }}> (may impact performance)</span>}
          </label>
          <input
            type="range"
            min="1000"
            max="100000"
            step="1000"
            value={numParticles}
            onChange={(e) => setNumParticles(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', marginTop: '4px' }}>
            <span>1K</span>
            <span>25K</span>
            <span>50K</span>
            <span>75K</span>
            <span>100K</span>
          </div>
        </div>

        {/* Features */}
        <div style={{
          background: 'rgba(33, 150, 243, 0.15)',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '15px',
          fontSize: '12px',
          lineHeight: '1.7'
        }}>
          <strong style={{ color: '#2196F3' }}>Data Sources:</strong><br />
          ✓ GPU-accelerated rendering<br />
          ✓ GEOS FP wind data (2022-02-28)<br />
          ✓ OCO-2 CO2 satellite data<br />
          ✓ Age-based particle fading<br />
          ✓ Dynamic particle count
        </div>

        {/* Info */}
        <div style={{
          fontSize: '11px',
          color: '#bbb',
          lineHeight: '1.6'
        }}>
          <strong style={{ color: '#fff' }}>How it works:</strong><br />
          • Particles follow wind direction<br />
          • U (eastward) + V (northward)<br />
          {colorBy === 'wind' ? (
            <>
              • <strong style={{ color: '#4CAF50' }}>Color by wind speed</strong><br />
              • Blue=slow, Red=fast wind
            </>
          ) : (
            <>
              • <strong style={{ color: '#4CAF50' }}>Color by CO2 concentration</strong><br />
              • Blue=low, Red=high CO2
            </>
          )}
        </div>
      </div>

      {/* Velocity Field Visualization (Optional Debug) */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '10px',
        borderRadius: '4px',
        color: 'white',
        fontSize: '11px',
      }}>
        Flow: GEOS FP Wind (Feb 28, 2022 01:30 UTC)<br />
        Color: {colorBy === 'wind' ? 'Wind Speed' : 'OCO-2 CO2 (Feb 28, 2022)'}<br />
        Field: {FIELD_WIDTH}x{FIELD_HEIGHT} | FPS: ~{(1000 / 16).toFixed(0)}
      </div>
    </div>
  );
}
