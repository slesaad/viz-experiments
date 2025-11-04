import { useState, useEffect, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, ScatterplotLayer, PointCloudLayer } from '@deck.gl/layers';
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

function generate3DWindArrows(windData, numArrows = 1000) {
  const { lats, lons, levels, heights, u, v, omega, metadata } = windData;
  const { grid_size } = metadata;

  const arrows = [];

  // Use all available data points - no stepping
  for (let zi = 0; zi < heights.length; zi++) {
    for (let yi = 0; yi < lats.length; yi++) {
      for (let xi = 0; xi < lons.length; xi++) {
        // Get wind components
        const uWind = u[zi][yi][xi];
        const vWind = v[zi][yi][xi];
        const wWind = omega[zi][yi][xi] * 100; // Scale vertical velocity to meters

        const speed = Math.sqrt(uWind * uWind + vWind * vWind + wWind * wWind);

        arrows.push({
          position: [lons[xi], lats[yi], heights[zi]],
          velocity: [uWind, vWind, wWind],
          speed,
        });
      }
    }
  }

  return arrows;
}

export default function VolumetricWindVisualization() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [arrowSize, setArrowSize] = useState(10000);
  const [numArrows, setNumArrows] = useState(500);
  const [showBasemap, setShowBasemap] = useState(true);
  const [arrows, setArrows] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(-1); // -1 means show all levels

  // Generate arrows on mount and when numArrows changes
  useEffect(() => {
    console.log('Generating 3D wind arrows from wind data...');
    const newArrows = generate3DWindArrows(windData3D, numArrows);
    console.log(newArrows);
    setArrows(newArrows);
    console.log(`Generated ${newArrows.length} wind arrows`);
   
  }, []);

  // Create volumetric arrow layer
  const volumetricLayer = useMemo(() => {
    // Filter arrows by selected level if specified
    const filteredArrows = selectedLevel === -1
      ? arrows
      : arrows.filter(d => {
          const heightIndex = windData3D.heights.indexOf(d.position[2]);
          return heightIndex === selectedLevel;
        });

    console.log(`Creating layer with ${filteredArrows.length} arrows (level ${selectedLevel}), size: ${arrowSize}`);

    return new PointCloudLayer({
      id: 'volumetric-arrows',
      data: filteredArrows,
      getPosition: d => d.position,
      pointSize: 10,
      sizeUnits: 'pixels',
      getColor: d => {
        // Map velocity components to color
        // Normalize each component to 0-255 range
        const [u, v, w] = d.velocity;
        const maxWind = 50; // Max expected wind speed component

        const r = Math.min(255, Math.max(0, ((u + maxWind) / (2 * maxWind)) * 255));
        const g = Math.min(255, Math.max(0, ((v + maxWind) / (2 * maxWind)) * 255));
        const b = Math.min(255, Math.max(0, ((w + maxWind) / (2 * maxWind)) * 255));

        return [r, g, b, 200];
      },
    });
  }, [arrows, arrowSize, selectedLevel]);

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
            <strong>Wind Vectors:</strong>
            <span style={{ color: '#4CAF50', marginLeft: '8px' }}>
              {numArrows.toLocaleString()}
            </span>
          </div>
          <div>
            <strong>Levels:</strong> {windData3D.metadata.grid_size.depth} pressure levels
          </div>
        </div>

        {/* Arrow Size Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Line Length: {(arrowSize / 1000).toFixed(0)}km
          </label>
          <input
            type="range"
            min="3000"
            max="30000"
            step="1000"
            value={arrowSize}
            onChange={(e) => setArrowSize(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Vector Count Control */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Vector Count: {numArrows.toLocaleString()}
            {numArrows > 3000 && <span style={{ color: '#FFB74D', fontSize: '11px' }}> (may impact performance)</span>}
          </label>
          <input
            type="range"
            min="100"
            max="5000"
            step="100"
            value={numArrows}
            onChange={(e) => setNumArrows(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', marginTop: '4px' }}>
            <span>100</span>
            <span>1K</span>
            <span>2.5K</span>
            <span>5K</span>
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
          Lines show wind direction<br />
          Red tip indicates flow direction
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
