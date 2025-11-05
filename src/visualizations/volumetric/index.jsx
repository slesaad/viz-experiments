import { useState, useEffect, useMemo, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, ScatterplotLayer, PointCloudLayer, LineLayer } from '@deck.gl/layers';
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

// Initialize particles with random positions within bounds
function initializeParticles(windData, numParticles, levelIndex = -1) {
  const { lats, lons, heights } = windData;
  const particles = [];

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  for (let i = 0; i < numParticles; i++) {
    const lon = minLon + Math.random() * (maxLon - minLon);
    const lat = minLat + Math.random() * (maxLat - minLat);
    const height = levelIndex === -1
      ? heights[Math.floor(Math.random() * heights.length)]
      : heights[levelIndex];

    // Sample wind at initial position to get starting velocity
    const wind = sampleWindAtPosition(windData, lon, lat, height);

    particles.push({
      position: [lon, lat, height],
      age: Math.random() * 100, // Random starting age for fade effect
      velocity: [wind.u, wind.v, wind.w],
      speed: wind.speed,
    });
  }

  return particles;
}

// Sample wind data at any position using nearest neighbor interpolation
function sampleWindAtPosition(windData, lon, lat, height) {
  const { lats, lons, heights, u, v, omega } = windData;

  // Find nearest grid point using minimum distance
  let lonIdx = 0;
  let minLonDist = Math.abs(lons[0] - lon);
  for (let i = 1; i < lons.length; i++) {
    const dist = Math.abs(lons[i] - lon);
    if (dist < minLonDist) {
      minLonDist = dist;
      lonIdx = i;
    }
  }

  let latIdx = 0;
  let minLatDist = Math.abs(lats[0] - lat);
  for (let i = 1; i < lats.length; i++) {
    const dist = Math.abs(lats[i] - lat);
    if (dist < minLatDist) {
      minLatDist = dist;
      latIdx = i;
    }
  }

  // Find nearest height index - CRITICAL for multi-level support
  let heightIdx = 0;
  let minHeightDist = Math.abs(heights[0] - height);
  for (let i = 1; i < heights.length; i++) {
    const dist = Math.abs(heights[i] - height);
    if (dist < minHeightDist) {
      minHeightDist = dist;
      heightIdx = i;
    }
  }

  const zi = heightIdx;
  const yi = latIdx;
  const xi = lonIdx;

  const uWind = u[zi]?.[yi]?.[xi] || 0;
  const vWind = v[zi]?.[yi]?.[xi] || 0;
  const wWind = (omega[zi]?.[yi]?.[xi] || 0) * 100;

  const speed = Math.sqrt(uWind * uWind + vWind * vWind + wWind * wWind);

  return { u: uWind, v: vWind, w: wWind, speed, heightIdx };
}

export default function VolumetricWindVisualization() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [numParticles, setNumParticles] = useState(5000);
  const [showBasemap, setShowBasemap] = useState(true);
  const [particles, setParticles] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(-1); // -1 means show all levels
  const animationRef = useRef(null);
  const selectedLevelRef = useRef(selectedLevel); // Track level for animation loop

  // Update ref when selectedLevel changes
  useEffect(() => {
    selectedLevelRef.current = selectedLevel;
  }, [selectedLevel]);

  // Initialize particles on mount or when settings change
  useEffect(() => {
    console.log('Initializing particles...');
    const newParticles = initializeParticles(windData3D, numParticles, selectedLevel);
    setParticles(newParticles);
    console.log(`Initialized ${newParticles.length} particles`);

    // Debug: Check speed and height distribution
    const speeds = newParticles.map(p => p.speed).filter(s => s > 0);
    const heights = newParticles.map(p => p.position[2]);
    const uniqueHeights = [...new Set(heights)];

    if (speeds.length > 0) {
      console.log('Particle stats:', {
        speeds: {
          min: Math.min(...speeds).toFixed(2),
          max: Math.max(...speeds).toFixed(2),
          avg: (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(2),
        },
        heights: {
          unique: uniqueHeights.length,
          levels: uniqueHeights.map(h => (h / 1000).toFixed(1) + 'km').join(', ')
        },
        sample: newParticles.slice(0, 5).map(p => {
          const testWind = sampleWindAtPosition(windData3D, p.position[0], p.position[1], p.position[2]);
          return {
            speed: p.speed?.toFixed(2),
            height: (p.position[2] / 1000).toFixed(1) + 'km',
            heightIdx: testWind.heightIdx,
            velocity: p.velocity?.map(v => v.toFixed(1)),
            u: p.velocity[0].toFixed(1),
            v: p.velocity[1].toFixed(1)
          };
        })
      });

      // Check if all heights are sampling correctly
      console.log('Available heights:', windData3D.heights.map(h => (h/1000).toFixed(1) + 'km'));
    }
  }, [numParticles, selectedLevel]);

  // Animation loop to update particle positions
  useEffect(() => {
    let lastTime = Date.now();
    const maxAge = 100; // Maximum particle age before respawn

    const animate = () => {
      const currentTime = Date.now();
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      setParticles(prevParticles => {
        return prevParticles.map(particle => {
          const [lon, lat, height] = particle.position;

          // Sample wind at current position
          const wind = sampleWindAtPosition(windData3D, lon, lat, height);

          // Update position based on wind velocity
          // Scale factor to convert m/s to degrees per second (approximate)
          const lonScale = 0.0001; // Adjust for visual effect - increased 10x
          const latScale = 0.0001;

          const newLon = lon + wind.u * lonScale * deltaTime;
          const newLat = lat + wind.v * latScale * deltaTime;

          // Age the particle
          const newAge = particle.age + deltaTime * 10;

          // Check if particle is out of bounds or too old
          const { lats, lons } = windData3D;
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLon = Math.min(...lons);
          const maxLon = Math.max(...lons);

          if (newLon < minLon || newLon > maxLon ||
              newLat < minLat || newLat > maxLat ||
              newAge > maxAge) {
            // Respawn particle at random position
            const resetLon = minLon + Math.random() * (maxLon - minLon);
            const resetLat = minLat + Math.random() * (maxLat - minLat);

            // Determine height based on selectedLevel
            const { heights } = windData3D;
            const resetHeight = selectedLevelRef.current === -1
              ? heights[Math.floor(Math.random() * heights.length)] // Random level
              : heights[selectedLevelRef.current]; // Specific level

            const resetWind = sampleWindAtPosition(windData3D, resetLon, resetLat, resetHeight);
            return {
              position: [resetLon, resetLat, resetHeight],
              age: 0,
              velocity: [resetWind.u, resetWind.v, resetWind.w],
              speed: resetWind.speed,
            };
          }

          return {
            position: [newLon, newLat, height],
            age: newAge,
            velocity: [wind.u, wind.v, wind.w],
            speed: wind.speed,
          };
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Create particle layer - elongated lines in wind direction
  const particleLayer = useMemo(() => {
    console.log(`Creating layer with ${particles.length} particles`);

    return new LineLayer({
      id: 'wind-particles',
      data: particles,
      getSourcePosition: d => d.position,
      getTargetPosition: d => {
        const [lon, lat, height] = d.position;
        const [u, v, w] = d.velocity || [0, 0, 0];

        // Scale factor to convert m/s to visual length
        // Adjust these values to control line length
        const lengthScale = 0.05; // degrees per m/s - increased 10x for longer lines
        const heightScale = 500; // meters per m/s for vertical component - increased 10x

        // Calculate end point offset by velocity
        const endLon = lon + u * lengthScale;
        const endLat = lat + v * lengthScale;
        const endHeight = height + w * heightScale;

        return [endLon, endLat, endHeight];
      },
      getColor: d => {
        // Map velocity components to color (same as before)
        const [u, v, w] = d.velocity || [0, 0, 0];
        const maxWind = 50; // Max expected wind speed component

        const r = Math.min(255, Math.max(0, ((u + maxWind) / (2 * maxWind)) * 255));
        const g = Math.min(255, Math.max(0, ((v + maxWind) / (2 * maxWind)) * 255));
        const b = Math.min(255, Math.max(0, ((w + maxWind) / (2 * maxWind)) * 255));

        // Fade based on age for trail effect
        const maxAge = 100;
        const alpha = Math.floor((1 - d.age / maxAge) * 255);

        return [r, g, b, alpha];
      },
      getWidth: 3,
      widthUnits: 'pixels',
    });
  }, [particles]);

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

  const layers = [basemapLayer, particleLayer].filter(Boolean);

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
          3D Wind Particle Advection
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

        {/* Particle Count Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Particle Count: {numParticles.toLocaleString()}
            {numParticles > 10000 && <span style={{ color: '#FFB74D', fontSize: '11px' }}> (may impact performance)</span>}
          </label>
          <input
            type="range"
            min="1000"
            max="20000"
            step="1000"
            value={numParticles}
            onChange={(e) => setNumParticles(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', marginTop: '4px' }}>
            <span>1K</span>
            <span>5K</span>
            <span>10K</span>
            <span>15K</span>
            <span>20K</span>
          </div>
        </div>

        {/* Pressure Level Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Pressure Level: {selectedLevel === -1 ? 'All Levels' : `${windData3D.levels[selectedLevel]} hPa (${(windData3D.heights[selectedLevel] / 1000).toFixed(1)} km)`}
          </label>
          <input
            type="range"
            min="-1"
            max={windData3D.heights.length - 1}
            step="1"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', marginTop: '4px' }}>
            <span>All</span>
            {windData3D.levels.map((level, idx) => (
              <span key={idx}>{level}</span>
            ))}
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
        <strong>Particle Color</strong>
        <div style={{ marginTop: '10px', fontSize: '10px', color: '#bbb', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#ff6666' }}>◉ Red</span> = Eastward (U+)
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#66ff66' }}>◉ Green</span> = Northward (V+)
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#6666ff' }}>◉ Blue</span> = Upward (W+)
          </div>
        </div>
        <div style={{ marginTop: '10px', fontSize: '10px', color: '#999' }}>
          Lines follow wind flow<br />
          Length shows wind speed<br />
          Color shows 3D wind direction<br />
          Fade indicates particle age
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
        3D Wind Particle Flow
      </div>
    </div>
  );
}
