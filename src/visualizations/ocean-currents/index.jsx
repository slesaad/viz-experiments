import { useState, useEffect, useMemo, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { createVelocityField, getVelocityStatistics } from './ocean-currents-velocity-field';
import { OceanParticleSystem } from './ocean-currents-particle-system';
import OceanCurrentsLayer from './OceanCurrentsLayer';
import oceanCurrentsData from './ocean_currents_grid.json';

// Initial view state for the map (centered on Pacific Ocean)
const INITIAL_VIEW_STATE = {
  longitude: 180,
  latitude: 0,
  zoom: 2,
  pitch: 0,
  bearing: 0,
  minZoom: 1,
  maxZoom: 8
};

// Global ocean bounds (from the data)
const OCEAN_BOUNDS = {
  west: 0.125,
  south: -89.875,
  east: 359.875,
  north: 89.875,
};

export default function OceanCurrentsVisualization() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [time, setTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [particleSize, setParticleSize] = useState(3.5);
  const [speedMultiplier, setSpeedMultiplier] = useState(50.0);
  const [numParticles, setNumParticles] = useState(50000);
  const [fadeOpacity, setFadeOpacity] = useState(0.9);
  const [speedThreshold, setSpeedThreshold] = useState(0);

  const velocityFieldRef = useRef(null);
  const particleSystemRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const [velocityStats, setVelocityStats] = useState(null);

  // Initialize velocity field and particle system
  useEffect(() => {
    console.log('Initializing ocean currents velocity field...');

    // Create velocity field from loaded data
    const velocityField = createVelocityField(oceanCurrentsData);
    velocityFieldRef.current = velocityField;

    // Get statistics for color scaling
    const stats = getVelocityStatistics(velocityField);
    setVelocityStats(stats);
    console.log('Velocity field statistics:', stats);

    // Initialize particle system
    particleSystemRef.current = new OceanParticleSystem({
      numParticles: numParticles,
      bounds: OCEAN_BOUNDS,
      minAge: 100,
      maxAge: 300,
      speedMultiplier,
    });

    console.log('Initialization complete');
  }, []);

  // Update particle count when it changes
  useEffect(() => {
    if (velocityFieldRef.current) {
      particleSystemRef.current = new OceanParticleSystem({
        numParticles: numParticles,
        bounds: OCEAN_BOUNDS,
        minAge: 100,
        maxAge: 300,
        speedMultiplier,
      });
    }
  }, [numParticles]);

  // Update speed multiplier
  useEffect(() => {
    if (particleSystemRef.current) {
      particleSystemRef.current.speedMultiplier = speedMultiplier;
    }
  }, [speedMultiplier]);

  // Animation loop
  useEffect(() => {
    if (isPaused || !velocityFieldRef.current) return;

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

  // Update particles and prepare data for rendering
  const particleData = useMemo(() => {
    if (!particleSystemRef.current || !velocityFieldRef.current) {
      return [];
    }

    // Update particle system
    particleSystemRef.current.update(velocityFieldRef.current, 16);

    // Get particle data
    const positions = particleSystemRef.current.getPositions();
    const ages = particleSystemRef.current.getAges();
    const speedValues = particleSystemRef.current.getSpeedValues();
    const velocities = particleSystemRef.current.getVelocities();

    // Convert to data array for the layer
    const data = [];
    for (let i = 0; i < ages.length; i++) {
      data.push({
        position: [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]],
        age: ages[i],
        speed: speedValues[i],
        velocity: [velocities[i * 2], velocities[i * 2 + 1]],
      });
    }

    return data;
  }, [time]);

  // Create ocean currents layer
  const oceanCurrentsLayer = useMemo(() => {
    if (!velocityStats) return null;

    // Color scale: Blue (slow) -> Cyan -> Yellow -> Red (fast)
    const colorScale = [
      [0.05, 0.2, 0.6],   // Deep blue
      [0.1, 0.6, 0.9],    // Cyan
      [0.9, 0.9, 0.2],    // Yellow
      [1.0, 0.2, 0.05],   // Red
    ];

    return new OceanCurrentsLayer({
      id: 'ocean-currents',
      data: particleData,
      getPosition: d => d.position,
      getAge: d => d.age,
      getSpeed: d => d.speed,
      getVelocity: d => d.velocity,
      particleSize,
      fadeOpacity,
      time: time / 1000,
      speedRange: {
        min: velocityStats.minSpeed,
        max: velocityStats.maxSpeed,
      },
      speedThreshold,
      colorScale,
    });
  }, [particleData, particleSize, fadeOpacity, time, velocityStats, speedThreshold]);

  // Basemap layer
  const basemapLayer = useMemo(() => {
    return new TileLayer({
      data: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
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
        });
      }
    });
  }, []);

  const layers = [basemapLayer, oceanCurrentsLayer].filter(Boolean);

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
        minWidth: '320px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>
          Ocean Currents Particle Flow
        </h3>

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
          {velocityStats && (
            <div>
              <strong>Speed Range:</strong>
              <span style={{ marginLeft: '8px' }}>
                {velocityStats.minSpeed.toFixed(4)} - {velocityStats.maxSpeed.toFixed(4)} m/s
              </span>
            </div>
          )}
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
            min="1"
            max="10"
            step="0.5"
            value={particleSize}
            onChange={(e) => setParticleSize(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Fade Opacity Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Trail Fade: {fadeOpacity.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={fadeOpacity}
            onChange={(e) => setFadeOpacity(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Velocity Threshold Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Velocity Threshold: {speedThreshold.toFixed(4)} m/s
          </label>
          <input
            type="range"
            min="0"
            max={velocityStats ? velocityStats.maxSpeed : 1}
            step="0.0001"
            value={speedThreshold}
            onChange={(e) => setSpeedThreshold(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
            Hide particles with speed below threshold
          </div>
        </div>

        {/* Speed Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Animation Speed: {speedMultiplier.toFixed(0)}x
          </label>
          <input
            type="range"
            min="10"
            max="200"
            step="10"
            value={speedMultiplier}
            onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Particle Count Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Particle Count: {numParticles.toLocaleString()}
            {numParticles > 80000 && <span style={{ color: '#FFB74D', fontSize: '11px' }}> (may impact performance)</span>}
          </label>
          <input
            type="range"
            min="10000"
            max="150000"
            step="5000"
            value={numParticles}
            onChange={(e) => setNumParticles(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', marginTop: '4px' }}>
            <span>10K</span>
            <span>50K</span>
            <span>100K</span>
            <span>150K</span>
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
          <strong style={{ color: '#2196F3' }}>Features:</strong><br />
          ✓ GPU-accelerated particle rendering<br />
          ✓ Velocity field sampling (bilinear)<br />
          ✓ TTL-based particle lifecycle<br />
          ✓ Velocity threshold filtering<br />
          ✓ Wispy trail rendering<br />
          ✓ Speed-based coloring
        </div>

        {/* Info */}
        <div style={{
          fontSize: '11px',
          color: '#bbb',
          lineHeight: '1.6'
        }}>
          <strong style={{ color: '#fff' }}>How it works:</strong><br />
          • Particles advected by velocity field<br />
          • U (eastward) + V (northward) velocities<br />
          • Blue = slow currents<br />
          • Red = fast currents<br />
          • Particles fade in/out with age (TTL)
        </div>
      </div>

      {/* Data Info */}
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
        Ocean Velocity: UVEL + VVEL (1992-01)<br />
        Resolution: 1440x720 (0.25° grid)<br />
        Data: NetCDF Ocean Currents<br />
        Rendering: Custom deck.gl Layer + GLSL
      </div>
    </div>
  );
}
