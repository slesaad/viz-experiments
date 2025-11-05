import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { GeoJsonLayer, BitmapLayer } from '@deck.gl/layers';
import { MaskExtension } from '@deck.gl/extensions';

// Alabama center coordinates
const INITIAL_VIEW_STATE = {
  longitude: -86.9023,
  latitude: 32.8067,
  zoom: 6,
  pitch: 0,
  bearing: 0,
};

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
    lineWidthMinPixels: 2,
    getLineColor: [255, 0, 0],
  });

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={[maskLayer, maskedTileLayer, boundaryLayer]}
    />
  );
}
