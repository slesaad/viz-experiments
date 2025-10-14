import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { PolygonLayer, BitmapLayer } from '@deck.gl/layers';
import RippleLayer from './ripples.ts';
import { AmbientLight, DirectionalLight, LightingEffect } from '@deck.gl/core';
import { COORDINATE_SYSTEM } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';


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

// WMTS endpoint for storm surge data
const WMTS_URL = 'https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/Storm_Surge_HazardMaps_Category2_v3/MapServer/WMTS/tile/1.0.0/Storm_Surge_HazardMaps_Category2_v3/default/default028mm/{z}/{y}/{x}.png';

// Color to surge height mapping based on NHC legend
const COLOR_TO_HEIGHT = {
  // Blue: Less than 3 feet (0-3ft = 0-0.9m)
  'blue': { min: 0, max: 0.9, color: [0, 112, 255] },
  // Yellow: Greater than 3 feet (3-6ft = 0.9-1.8m)
  'yellow': { min: 0.9, max: 1.8, color: [255, 255, 0] },
  // Orange: Greater than 6 feet (6-9ft = 1.8-2.7m)
  'orange': { min: 1.8, max: 2.7, color: [255, 170, 0] },
  // Red: Greater than 9 feet (9+ft = 2.7+m)
  'red': { min: 2.7, max: 4.5, color: [255, 0, 0] }
};

// Function to classify pixel color to surge category
function classifyColor(r, g, b) {
  // Blue range
  if (b > 200 && r < 100 && g < 150) {
    return COLOR_TO_HEIGHT.blue;
  }
  // Yellow range
  if (r > 200 && g > 200 && b < 100) {
    return COLOR_TO_HEIGHT.yellow;
  }
  // Orange range
  if (r > 200 && g > 100 && g < 200 && b < 100) {
    return COLOR_TO_HEIGHT.orange;
  }
  // Red range
  if (r > 200 && g < 100 && b < 100) {
    return COLOR_TO_HEIGHT.red;
  }
  // No surge data or white background
  return null;
}

// Convert tile coordinates to lat/lng bounds
function tile2LatLng(x, y, z) {
  const n = Math.pow(2, z);
  const lng_left = (x / n) * 360 - 180;
  const lng_right = ((x + 1) / n) * 360 - 180;
  const lat_top = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  const lat_bottom = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;

  return {
    west: lng_left,
    east: lng_right,
    north: lat_top,
    south: lat_bottom
  };
}


// Create lights
const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 0.5 });
const directionalLight = new DirectionalLight({
  color: [255, 255, 255],
  intensity: 1.0,
  direction: [-1, -2, -3]
});

const lightingEffect = new LightingEffect({ ambientLight, directionalLight });

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const BUILDINGS_URL = `https://tile.googleapis.com/v1/3dtiles/root.json`;

const centerLatitude = 25.7880796;
const centerLongitude = -80.2228099;


export default function Root() {

  const initialViewState = {
    longitude: centerLongitude,
    latitude: centerLatitude,
    zoom: 16,
    pitch: 50,
    bearing: 0,
  }

  const [viewState, setViewState] = useState(initialViewState);

  const [time, setTime] = useState(0);
  const loopLength = 1800; // how long the trip runs (in timestamps)
  const animationSpeed = 1; // speed multiplier

  const [terrainElevation, setTerrainElevation] = useState(null);
  const [isLoadingElevation, setIsLoadingElevation] = useState(false);

  const [waterLevel, setWaterLevel] = useState(-25.0);
  const [tilesOrigin, setTilesOrigin] = useState(null);

  const [surgePolygons, setSurgePolygons] = useState([]);
  const [showRasterOverlay, setShowRasterOverlay] = useState(false);
  const tileCache = useRef(new Map());

  // Process tile image to extract surge polygons
  const processTileImage = (image, x, y, z) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const tileBounds = tile2LatLng(x, y, z);
    const polygons = [];

    // Sample grid - adjust resolution based on performance
    const gridSize = 20; // Sample every 20 pixels
    const cellWidth = canvas.width / gridSize;
    const cellHeight = canvas.height / gridSize;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // Sample center of cell
        const px = Math.floor(col * cellWidth + cellWidth / 2);
        const py = Math.floor(row * cellHeight + cellHeight / 2);
        const idx = (py * canvas.width + px) * 4;

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (a < 10) continue; // Skip transparent pixels

        const category = classifyColor(r, g, b);
        if (!category) continue;

        // Create polygon for this grid cell
        const lngStep = (tileBounds.east - tileBounds.west) / gridSize;
        const latStep = (tileBounds.north - tileBounds.south) / gridSize;

        const west = tileBounds.west + col * lngStep;
        const east = tileBounds.west + (col + 1) * lngStep;
        const north = tileBounds.north - row * latStep;
        const south = tileBounds.north - (row + 1) * latStep;

        polygons.push({
          polygon: [
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south]
          ],
          height: (category.min + category.max) / 2, // Average height for category
          category: category,
          color: [...category.color, 180] // Add alpha
        });
      }
    }

    return polygons;
  };

  // WMTS Tile Layer (for loading data)
  const wmtsLayer = useMemo(() => {
    return new TileLayer({
      id: 'wmts-surge-tiles',
      data: WMTS_URL,
      minZoom: 0,
      maxZoom: 14,
      tileSize: 256,

      renderSubLayers: props => {
        const { tile } = props;

        if (!props.data || !tile) return null;

        console.log(props.data)

        return new BitmapLayer({
          ...props,
          id: `${props.id}-bitmap`,
          image: props.data,
          bounds: [tile.bbox.west, tile.bbox.south, tile.bbox.east, tile.bbox.north],
          visible: showRasterOverlay,
          opacity: 0.5
        });
      },

      getTileData: async ({ index }) => {
        const { x, y, z } = index;
        const url = WMTS_URL
          .replace('{z}', z)
          .replace('{x}', x)
          .replace('{y}', y);

        return new Promise((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';

          image.onload = () => {
            // Process tile for surge polygons
            const cacheKey = `${z}-${x}-${y}`;

            if (!tileCache.current.has(cacheKey)) {
              const polygons = processTileImage(image, x, y, z);
              tileCache.current.set(cacheKey, polygons);

              // Update all polygons
              const allPolygons = Array.from(tileCache.current.values()).flat();
              setSurgePolygons(allPolygons);
            }

            resolve(image);
          };

          image.onerror = () => {
            console.error('Failed to load tile:', url);
            resolve(null);
          };

          image.src = url;
        });
      },

      onTileLoad: (tile) => {
        const { x, y, z } = tile.index;
        const cacheKey = `${z}-${x}-${y}`;

        if (tileCache.current.has(cacheKey)) return;

        if (tile.content instanceof HTMLImageElement) {
          const polygons = processTileImage(tile.content, x, y, z);
          tileCache.current.set(cacheKey, polygons);

          // Update all polygons
          const allPolygons = Array.from(tileCache.current.values()).flat();
          setSurgePolygons(allPolygons);
        }
      },

      onTileUnload: (tile) => {
        const { x, y, z } = tile.index;
        const cacheKey = `${z}-${x}-${y}`;
        tileCache.current.delete(cacheKey);

        // Update all polygons
        const allPolygons = Array.from(tileCache.current.values()).flat();
        setSurgePolygons(allPolygons);
      }
    });
  }, [showRasterOverlay]);

  // Fetch terrain elevation from Google Elevation API
  // Fetch terrain elevation from Google Elevation API
  const fetchTerrainElevation = useCallback(async (lat, lng) => {
    setIsLoadingElevation(true);
    try {
      // Using Open-Elevation API (free, no API key needed, CORS-enabled)
      // Alternative to Google Elevation API
      const response = await fetch(
        `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const elevation = data.results[0].elevation;
        setTerrainElevation(elevation);
        console.log('Terrain elevation:', elevation, 'meters');
      } else {
        console.error('Elevation API error');
        setTerrainElevation(0); // Fallback to sea level
      }
    } catch (error) {
      console.error('Failed to fetch elevation:', error);
      setTerrainElevation(0); // Fallback to sea level
    } finally {
      setIsLoadingElevation(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTerrainElevation(viewState.latitude, viewState.longitude);
    }, 1000); // Wait 1 second after user stops moving

    return () => clearTimeout(timer);
  }, [viewState.latitude, viewState.longitude, fetchTerrainElevation]);

  // Calculate actual water height (terrain elevation + storm surge)
  const actualWaterHeight = useMemo(() => {
    if (terrainElevation === null) return 0;
    // return terrainElevation + waterLevel;
    return waterLevel;
  }, [terrainElevation, waterLevel]);

  // Fetch elevation on mount and when view center changes significantly
  useEffect(() => {
    fetchTerrainElevation(viewState.latitude, viewState.longitude);
  }, []); // Only on mount

  // animate currentTime
  useEffect(() => {
    let frame;
    const animate = () => {
      setTime(t => (t + animationSpeed) % loopLength);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

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
    opacity: 0.9,
    pointSize: 2,
    // Ensure proper coordinate alignment
    _subLayerProps: {
      scenegraph: {
        _lighting: 'pbr'
      }
    },
    onTilesetLoad: tileset => {
      const center = tileset.cartographicCenter; // [lng, lat, height]
      console.log(">>>center is", center)
      // You can now use this as coordinateOrigin
      setTilesOrigin(center);
    }
  })

  function lonLatToECEF(lon, lat, height = 0) {
    const a = 6378137.0; // Earth's radius (WGS84 semi-major)
    const e2 = 6.69437999014e-3; // eccentricity squared

    const radLat = lat * Math.PI / 180;
    const radLon = lon * Math.PI / 180;

    const N = a / Math.sqrt(1 - e2 * Math.sin(radLat) * Math.sin(radLat));

    const x = (N + height) * Math.cos(radLat) * Math.cos(radLon);
    const y = (N + height) * Math.cos(radLat) * Math.sin(radLon);
    const z = (N * (1 - e2) + height) * Math.sin(radLat);

    return [x, y, z];
  }

  // const waterPolygon = [
  //   [
  //     [centerLongitude, centerLatitude],
  //     [centerLongitude - 0.2, centerLatitude],
  //     [centerLongitude - 0.2, centerLatitude + 0.2],
  //     [centerLongitude, centerLatitude + 0.2],
  //   ]
  // ];
  const waterPolygon = useMemo(() => {
    const center = [viewState.longitude, viewState.latitude];
    const size = 0.05; // degrees, adjust based on zoom
    return [
      [center[0] - size, center[1] - size],
      [center[0] + size, center[1] - size],
      [center[0] + size, center[1] + size],
      [center[0] - size, center[1] + size],
      [center[0] - size, center[1] - size]
    ];
  }, [viewState.longitude, viewState.latitude]);

  // const poly = new RippleLayer({
  //   id: 'water-layer',
  //   data: [{polygon: waterPolygon}],
  //   getPolygon: d => d.polygon,
  //   getElevation: () => waterHeight, // meters above ground
  //   extruded: true,
  //   getFillColor: [30, 144, 255, 120],
  //   currentTime: time,
  //   wireframe: false,
  // });

  // Water layer using PolygonLayer
  const waterLayer = useMemo(() => {
    if (terrainElevation === null) return null;

    return new PolygonLayer({
      id: 'water-surface',
      data: surgePolygons,
      // data: [{
      //   polygon: surgePolygons,
      //   elevation: actualWaterHeight
      // }],
      getPolygon: d => d.polygon,
      getElevation: d => d.height * 1.2,
      getFillColor: d => d.color,
      getLineColor: [80, 200, 220, 200],
      lineWidthMinPixels: 1,
      extruded: true,
      wireframe: false,
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      // material: {
      //   ambient: 0.35,
      //   diffuse: 0.6,
      //   shininess: 32,
      //   specularColor: [255, 255, 255]
      // },
      parameters: {
        depthTest: true,
        blend: true
      }
    });
  }, [actualWaterHeight, surgePolygons, terrainElevation]);


  return (
    <>
      <DeckGL
        initialViewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        controller
        getTooltip={({ object }) =>
          object && object.position.join(', ')
        }
        // layers={[wmtsLayer, waterLayer]}
        layers={[tiles3dlayer, wmtsLayer, waterLayer]}
        // layers={[tiles3dlayer, poly]}
        // layers={[ poly]}
        effects={[lightingEffect]}  // <- add lighting
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
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>
          Storm Surge Control
        </h3>

        {/* Elevation Info */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '15px',
          fontSize: '13px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Terrain Elevation:</strong>
            {isLoadingElevation ? (
              <span style={{ color: '#FFD700', marginLeft: '8px' }}>Loading...</span>
            ) : terrainElevation !== null ? (
              <span style={{ color: '#4CAF50', marginLeft: '8px' }}>
                {terrainElevation.toFixed(2)}m above sea level
              </span>
            ) : (
              <span style={{ color: '#888', marginLeft: '8px' }}>Unknown</span>
            )}
          </div>

          <div style={{ marginBottom: '8px' }}>
            <strong>Storm Surge Height:</strong>
            <span style={{ color: '#2196F3', marginLeft: '8px' }}>
              +{waterLevel.toFixed(1)}m
            </span>
          </div>

          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.2)',
            paddingTop: '8px',
            marginTop: '8px'
          }}>
            <strong>Total Water Height:</strong>
            <span style={{
              color: waterLevel > 5 ? '#FF5252' : '#FFB74D',
              marginLeft: '8px',
              fontSize: '15px',
              fontWeight: 'bold'
            }}>
              {actualWaterHeight.toFixed(2)}m above sea level
            </span>
          </div>
        </div>

        {/* Water Level Slider */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            Storm Surge Height: {waterLevel.toFixed(1)}m
          </label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={waterLevel}
            onChange={(e) => setWaterLevel(parseFloat(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#2196F3'
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#888',
            marginTop: '4px'
          }}>
            <span>No surge</span>
            <span>Catastrophic</span>
          </div>
        </div>

        {/* Scale Reference */}
        <div style={{
          background: 'rgba(33, 150, 243, 0.15)',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '15px',
          fontSize: '12px',
          lineHeight: '1.6'
        }}>
          <strong style={{ color: '#2196F3' }}>Storm Surge Scale:</strong><br />
          • 0-1m: Minor flooding<br />
          • 1-2m: Moderate flooding<br />
          • 2-4m: Significant flooding<br />
          • 4-6m: Severe flooding<br />
          • 6m+: Catastrophic
        </div>

        {/* Instructions */}
        <div style={{
          fontSize: '11px',
          color: '#aaa',
          lineHeight: '1.5'
        }}>
          <strong style={{ color: '#fff' }}>How it works:</strong><br />
          • Elevation API provides ground level<br />
          • Water height = ground + surge<br />
          • Move around to see different areas<br />
          • Elevation updates automatically
        </div>

        <div style={{
          fontSize: '11px',
          color: '#666',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <strong>Controls:</strong> Drag to rotate • Scroll to zoom • Right-click to pan
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoadingElevation && (
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(255, 215, 0, 0.9)',
          padding: '10px 20px',
          borderRadius: '6px',
          color: '#000',
          fontSize: '13px',
          fontWeight: 'bold',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          ⟳ Fetching terrain elevation...
        </div>
      )}

      {/* Warning for high water */}
      {waterLevel > 6 && (
        <div style={{
          position: 'absolute',
          bottom: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(244, 67, 54, 0.95)',
          padding: '12px 24px',
          borderRadius: '8px',
          color: 'white',
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          animation: 'pulse 2s infinite'
        }}>
          ⚠️ CATASTROPHIC FLOODING - {waterLevel.toFixed(1)}m surge
        </div>
      )}
    </>
  );
}

/* global document */
// const container = document.body.appendChild(document.createElement('div'));
// createRoot(container).render(<Root />);
