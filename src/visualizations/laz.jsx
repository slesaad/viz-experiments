import { createRoot } from 'react-dom/client';

import React, { useEffect, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { GeoArrowScatterplotLayer } from "@geoarrow/deck.gl-layers";
import * as arrow from "apache-arrow";


import {PointCloudLayer} from '@deck.gl/layers';
import {LASLoader} from '@loaders.gl/las';

const LAZ_SAMPLE =
  // 'http://localhost:3000/sofi.copc.laz';
  // 'http://localhost:3000/autzen-classified.copc.laz';
  'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/point-cloud-laz/indoor.0.1.laz';


export default function Root() {
  const layers = [
    new TileLayer({
      data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: props => {
        const { boundingBox: bbox, content: image } = props.tile;

        if (!image) return null;

        return new BitmapLayer(props, {
          data: null,
          image: image,
          bounds: [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]]
        })
      }
  }),
    new PointCloudLayer({
      id: 'laz-point-cloud-layer',
      data: LAZ_SAMPLE,
      getNormal: [0, 1, 0],
      getColor: [255, 255, 255],
      opacity: 0.5,
      pointSize: 1,
      // Additional format support can be added here
      loaders: [LASLoader]
    })
  ];


  return (
    <DeckGL
      initialViewState={{
        longitude: -177.5, // Change to your data's center if known
        latitude: -66,
        zoom: 2,
      }}
      controller={true}
      layers={layers}
    />
  );
}


/* global document */
// const container = document.body.appendChild(document.createElement('div'));
// createRoot(container).render(<Root />);
