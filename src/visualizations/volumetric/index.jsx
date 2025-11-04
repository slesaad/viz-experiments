import { useState, useEffect, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import Volumetric3DParticleLayer from './Volumetric3DParticleLayer';
import windData3D from './wind_data_3d_us.json';

// Initial view state for the map
const INITIAL_VIEW_STATE = {
  longitude: -98,
  latitude: 39,
  zoom: 4,
  pitch: 60,
  bearing: 0,
  minZoom: 3,
  maxZoom: 12
};

function generate3DParticles(windData, numParticles = 5000) {
  const { lats, lons, levels, heights, u, v, omega, metadata } = windData;
  const { grid_size } = metadata;

  const particles = [];

  for (let i = 0; i < numParticles; i++) {
    // Random position in the grid
    const xi = Math.floor(Math.random() * grid_size.width);
    const yi = Math.floor(Math.random() * grid_size.height);
    const zi = Math.floor(Math.random() * grid_size.depth);

    const lon = lons[xi];
    const lat = lats[yi];
    const height = heights[zi];

    // Get wind components
    const uWind = u[zi][yi][xi];
    const vWind = v[zi][yi][xi];
    const wWind = omega[zi][yi][xi] * 0.1; // Scale vertical velocity

    const speed = Math.sqrt(uWind * uWind + vWind * vWind + wWind * wWind);

    particles.push({
      position: [lon, lat, height],
      velocity: [uWind, vWind, wWind],
      speed,
    });
  }

  return particles;
}

export default function VolumetricWindVisualization() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [particleSize, setParticleSize] = useState(8);
  const [numParticles, setNumParticles] = useState(5000);
  const [showBasemap, setShowBasemap] = useState(true);
  const [particles, setParticles] = useState([]);

  // Generate particles on mount and when numParticles changes
  useEffect(() => {
    console.log('Generating 3D particles from wind data...');
    const newParticles = generate3DParticles(windData3D, numParticles);
    setParticles(newParticles);
    console.log(`Generated ${newParticles.length} particles`);
    if (newParticles.length > 0) {
      console.log('Sample particle:', newParticles[0]);
      console.log('Position range:', {
        lon: [Math.min(...newParticles.map(p => p.position[0])), Math.max(...newParticles.map(p => p.position[0]))],
        lat: [Math.min(...newParticles.map(p => p.position[1])), Math.max(...newParticles.map(p => p.position[1]))],
        height: [Math.min(...newParticles.map(p => p.position[2])), Math.max(...newParticles.map(p => p.position[2]))],
      });
    }
  }, [numParticles]);

  // Create volumetric particle layer
  const volumetricLayer = useMemo(() => {
    console.log(`Creating layer with ${particles.length} particles, size: ${particleSize}`);

    return new Volumetric3DParticleLayer({
      id: 'volumetric-particles',
      data: particles,
      getPosition: d => d.position,
      getSpeed: d => d.speed,
      particleSize,
      colorLow: [64, 128, 255, 200],
      colorHigh: [255, 64, 64, 200],
      speedRange: [0, 50],
    });
  }, [particles, particleSize]);

  // Basemap layer
  const basemapLayer = useMemo(() => {
    if (!showBasemap) return null;

    return new TileLayer({
      id: 'basemap',
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
  }, [showBasemap]);

  const layers = [basemapLayer, volumetricLayer].filter(Boolean);

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
          3D Volumetric Wind Field
        </h3>

        {/* Data Info */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '15px',
          fontSize: '13px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Dataset:</strong>
            <span style={{ color: '#4CAF50', marginLeft: '8px' }}>
              GEOS FP 3D
            </span>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Date:</strong> {windData3D.metadata.date}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Time:</strong> {windData3D.metadata.time}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Particles:</strong>
            <span style={{ color: '#4CAF50', marginLeft: '8px' }}>
              {numParticles.toLocaleString()}
            </span>
          </div>
          <div>
            <strong>Levels:</strong> {windData3D.metadata.grid_size.depth} pressure levels
          </div>
        </div>

        {/* Particle Size Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Particle Size: {particleSize.toFixed(1)} pixels
          </label>
          <input
            type="range"
            min="1"
            max="30"
            step="0.5"
            value={particleSize}
            onChange={(e) => setParticleSize(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Particle Count Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Particle Count: {numParticles.toLocaleString()}
            {numParticles > 10000 && <span style={{ color: '#FFB74D', fontSize: '11px' }}> (may impact performance)</span>}
          </label>
          <input
            type="range"
            min="500"
            max="20000"
            step="500"
            value={numParticles}
            onChange={(e) => setNumParticles(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', marginTop: '4px' }}>
            <span>500</span>
            <span>5K</span>
            <span>10K</span>
            <span>15K</span>
            <span>20K</span>
          </div>
        </div>

        {/* Basemap Toggle */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={showBasemap}
              onChange={(e) => setShowBasemap(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Show Basemap
          </label>
        </div>

        {/* Camera Controls */}
        <div style={{
          background: 'rgba(33, 150, 243, 0.15)',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '15px',
          fontSize: '12px',
          lineHeight: '1.7'
        }}>
          <strong style={{ color: '#2196F3' }}>Camera Controls:</strong><br />
          ✓ Drag to rotate<br />
          ✓ Scroll to zoom<br />
          ✓ Right-drag to pan<br />
          ✓ Cmd+drag to change pitch
        </div>

        {/* Reset View Button */}
        <button
          onClick={() => setViewState(INITIAL_VIEW_STATE)}
          style={{
            width: '100%',
            padding: '10px',
            background: '#2196F3',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            marginBottom: '15px',
          }}
        >
          Reset View
        </button>

        {/* Wind Statistics */}
        <div style={{
          fontSize: '11px',
          color: '#bbb',
          lineHeight: '1.6',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '15px',
        }}>
          <strong style={{ color: '#fff' }}>Wind Statistics:</strong><br />
          U: {windData3D.metadata.wind_stats.u_range[0].toFixed(1)} to {windData3D.metadata.wind_stats.u_range[1].toFixed(1)} m/s<br />
          V: {windData3D.metadata.wind_stats.v_range[0].toFixed(1)} to {windData3D.metadata.wind_stats.v_range[1].toFixed(1)} m/s<br />
          Speed: {windData3D.metadata.wind_stats.speed_range[0].toFixed(1)} to {windData3D.metadata.wind_stats.speed_range[1].toFixed(1)} m/s<br />
          Mean: {windData3D.metadata.wind_stats.mean_speed.toFixed(1)} m/s<br />
          Height: {(windData3D.metadata.wind_stats.height_range[0] / 1000).toFixed(1)} - {(windData3D.metadata.wind_stats.height_range[1] / 1000).toFixed(1)} km
        </div>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        background: 'rgba(0, 0, 0, 0.85)',
        padding: '15px',
        borderRadius: '8px',
        color: 'white',
        fontSize: '12px',
      }}>
        <strong>Wind Speed</strong>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginTop: '10px',
          gap: '10px'
        }}>
          <div style={{
            width: '120px',
            height: '20px',
            background: 'linear-gradient(to right, rgb(64, 128, 255), rgb(255, 64, 64))',
            borderRadius: '3px',
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '10px' }}>
            <span>High</span>
            <span style={{ marginTop: '2px' }}>Low</span>
          </div>
        </div>
        <div style={{ marginTop: '10px', fontSize: '10px', color: '#999' }}>
          Each particle represents wind<br />
          at a specific 3D location
        </div>
      </div>

      {/* Info Banner */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        background: 'rgba(76, 175, 80, 0.9)',
        padding: '12px 20px',
        borderRadius: '6px',
        color: 'white',
        fontSize: '13px',
        fontWeight: 'bold',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        3D Volumetric Wind Visualization
      </div>
    </div>
  );
}
