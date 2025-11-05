import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer, TerrainLayer } from '@deck.gl/geo-layers';
import { GeoJsonLayer, BitmapLayer } from '@deck.gl/layers';
import { MaskExtension } from '@deck.gl/extensions';

const mapboxAccessToken = import.meta.env.VITE_MAPBOX_API_KEY;

// Alabama center coordinates
const INITIAL_VIEW_STATE = {
  longitude: -86.9023,
  latitude: 32.8067,
  zoom: 7,
  pitch: 45,
  bearing: 0,
};

const elevationMultiplier = 10;

export default function MapMasking() {
  const [alabamaGeojson, setAlabamaGeojson] = useState(null);

  // Load Alabama GeoJSON
  useEffect(() => {
    fetch('/src/visualizations/map-masking/Alabama.geojson')
      .then(response => response.json())
      .then(data => setAlabamaGeojson(data));
  }, []);

  if (!alabamaGeojson) {
    return <div>Loading...</div>;
  }

  // Create mask layer (invisible layer that defines the mask region)
  const maskLayer = new GeoJsonLayer({
    id: 'mask-layer',
    data: alabamaGeojson,
    stroked: false,
    filled: true,
    getFillColor: [0, 0, 0, 0], // Transparent
    operation: 'mask',
  });

  // Terrain layer with elevation data (Mapbox terrain-rgb tiles)
  const terrainLayer = new TerrainLayer({
    id: 'terrain-layer',
    elevationDecoder: {
      rScaler: 6553.6 * elevationMultiplier,
      gScaler: 25.6 * elevationMultiplier,
      bScaler: 0.1 * elevationMultiplier,
      offset: -10000 * elevationMultiplier // Multiply offset too for proper scaling
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

  // Optional: show the Alabama boundary outline
  const boundaryLayer = new GeoJsonLayer({
    id: 'boundary-layer',
    data: alabamaGeojson,
    stroked: true,
    filled: false,
    lineWidthMinPixels: 5,
    getLineColor: [255, 0, 0],
  });

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={[maskLayer, terrainLayer, boundaryLayer]}
    />
  );
}
