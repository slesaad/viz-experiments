// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';

const INITIAL_VIEW_STATE = {
  latitude: 0,
  longitude: 0,
  zoom: 2,
  // bearing: 0,
  // pitch: 30
};

export default function Root() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  const tileLayer = new TileLayer({
    id: 'tile-layer',
    data: 'https://earth.gov/ghgcenter/api/raster/searches/e38c1b6e8f3e8f32154dab2e8bbd4e86/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=co2&colormap_name=bwr&rescale=-0.0007%2C0.0002',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: props => {
      const { boundingBox: bbox, content: image, zoom } = props.tile;

      if (!image) return null;

      // Convert image to canvas to read and modify pixel data
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Modify pixel data to add greenish hue
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const alpha = data[i + 3];

        if (alpha > 0) {  // Only modify visible pixels
          // Add green tint while preserving some of the original color
          data[i] = Math.floor(r * 0.7);     // Reduce red
          data[i + 1] = Math.floor(g * 1.3);  // Boost green
          data[i + 2] = Math.floor(b * 0.7);  // Reduce blue
        }
      }

      // Put the modified image data back
      ctx.putImageData(imageData, 0, 0);

      return [
        new BitmapLayer(props, {
          data: null,
          image: canvas,
          bounds: [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]]
        })
      ];
    }
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <DeckGL
        layers={[tileLayer]}
        initialViewState={INITIAL_VIEW_STATE}
        viewState={viewState}
        onViewStateChange={evt => setViewState(evt.viewState)}
        controller={true}
      />
    </div>
  );
}

/* global document */
// const container = document.body.appendChild(document.createElement('div'));
// createRoot(container).render(<Root />);
