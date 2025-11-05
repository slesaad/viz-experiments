import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer, TerrainLayer } from '@deck.gl/geo-layers';
import { GeoJsonLayer, BitmapLayer, PolygonLayer } from '@deck.gl/layers';
import { MaskExtension, ClipExtension } from '@deck.gl/extensions';
import { AmbientLight, DirectionalLight, LightingEffect } from '@deck.gl/core';

const mapboxAccessToken = import.meta.env.VITE_MAPBOX_API_KEY;

// Alabama center coordinates
const INITIAL_VIEW_STATE = {
  longitude: -86.9023,
  latitude: 32.8067,
  zoom: 7,
  pitch: 45,
  bearing: 0,
};

const elevationMultiplier = 30;

// Create lighting effects
const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0
});

const directionalLight = new DirectionalLight({
  color: [255, 255, 255],
  intensity: 2.0,
  direction: [-1, -3, -1]
});

const lightingEffect = new LightingEffect({ ambientLight, directionalLight });

export default function MapMasking() {
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('Alabama');
  const [stateGeojson, setStateGeojson] = useState(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  // Load states list
  useEffect(() => {
    fetch('/src/visualizations/map-masking/states.txt')
      .then(response => response.text())
      .then(text => {
        const stateList = text.split('\n').filter(s => s.trim());
        setStates(stateList);
      });
  }, []);

  // Load selected state GeoJSON
  useEffect(() => {
    if (!selectedState) return;

    setStateGeojson(null); // Reset while loading

    const url = `https://raw.githubusercontent.com/NASA-IMPACT/veda-ui/refs/heads/main/static/public/geo-data/states/${selectedState}.geojson`;
    fetch(url)
      .then(response => response.json())
      .then(data => {
        setStateGeojson(data);

        // Calculate bounds and center the view on the new state
        if (data.features && data.features.length > 0) {
          const bounds = calculateBounds(data);
          setViewState({
            longitude: (bounds.minLng + bounds.maxLng) / 2,
            latitude: (bounds.minLat + bounds.maxLat) / 2,
            zoom: calculateZoom(bounds),
            pitch: 45,
            bearing: 0,
          });
        }
      })
      .catch(error => {
        console.error('Error loading GeoJSON:', error);
      });
  }, [selectedState]);

  // Helper function to calculate bounds from GeoJSON
  const calculateBounds = (geojson) => {
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    const processCoords = (coords) => {
      if (typeof coords[0] === 'number') {
        minLng = Math.min(minLng, coords[0]);
        maxLng = Math.max(maxLng, coords[0]);
        minLat = Math.min(minLat, coords[1]);
        maxLat = Math.max(maxLat, coords[1]);
      } else {
        coords.forEach(processCoords);
      }
    };

    geojson.features.forEach(feature => {
      processCoords(feature.geometry.coordinates);
    });

    return { minLng, maxLng, minLat, maxLat };
  };

  // Helper function to calculate appropriate zoom level
  const calculateZoom = (bounds) => {
    const latDiff = bounds.maxLat - bounds.minLat;
    const lngDiff = bounds.maxLng - bounds.minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    if (maxDiff > 10) return 5;
    if (maxDiff > 5) return 6;
    if (maxDiff > 3) return 7;
    return 8;
  };

  if (!stateGeojson) {
    return <div>Loading...</div>;
  }

  // Create mask layer (invisible layer that defines the mask region)
  const maskLayer = new GeoJsonLayer({
    id: 'mask-layer',
    data: stateGeojson,
    stroked: false,
    filled: true,
    getFillColor: [0, 0, 0, 0], // Transparent
    operation: 'mask',
  });

  // Base tile layer - shows the full map context
  const baseTileLayer = new TileLayer({
    id: 'base-tile-layer',
    data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,

    renderSubLayers: props => {
      const { boundingBox } = props.tile;

      return new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
      });
    }
  });

  // Create a solid chunk underneath to make it look 3D
  const baseChunkLayer = new PolygonLayer({
    id: 'base-chunk-layer',
    data: stateGeojson.features,
    getPolygon: d => d.geometry.coordinates,
    getFillColor: [80, 60, 40], // Earth-brown color
    getElevation: 12000, // Negative elevation to create depth
    extruded: true,
    wireframe: false,
    material: {
      ambient: 0.5,
      diffuse: 0.6,
      shininess: 32,
    },
  });

  // Terrain layer with elevation data (Mapbox terrain-rgb tiles)
  const terrainLayer = new TerrainLayer({
    id: 'terrain-layer',
    elevationDecoder: {
      rScaler: 6553.6 * elevationMultiplier,
      gScaler: 25.6 * elevationMultiplier,
      bScaler: 0.1 * elevationMultiplier,
      offset: (-10000) * elevationMultiplier // Multiply offset too for proper scaling
    },
    elevationData: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.png?access_token=${mapboxAccessToken}`,
    texture: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    wireframe: false,
    color: [0, 0, 255],
    extensions: [new MaskExtension()],
    maskId: 'mask-layer',
  });

  // Create a tile layer that will be masked to Alabama's shape
  const maskedTileLayer = new TileLayer({
    id: 'masked-tile-layer',
    data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,

    renderSubLayers: props => {
      const { boundingBox, content: image } = props.tile;

      if (!image) return null;

      return new BitmapLayer({
        data: null,
        image: props.data,
        bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],

        // Apply the mask extension
        extensions: [new MaskExtension()],
        maskId: 'mask-layer',
      });
    }
  });

  // Optional: show the state boundary outline
  const boundaryLayer = new GeoJsonLayer({
    id: 'boundary-layer',
    data: stateGeojson,
    stroked: true,
    filled: false,
    lineWidthMinPixels: 5,
    getLineColor: [255, 0, 0],
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* State selector dropdown */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 1,
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        <label htmlFor="state-select" style={{ marginRight: '10px', fontWeight: 'bold' }}>
          Select State:
        </label>
        <select
          id="state-select"
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          style={{
            padding: '5px 10px',
            fontSize: '14px',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }}
        >
          {states.map(state => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>

      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        controller={true}
        layers={[baseTileLayer, maskLayer, terrainLayer]}
        effects={[lightingEffect]}
      />
    </div>
  );
}
