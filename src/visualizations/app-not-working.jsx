import { createRoot } from 'react-dom/client';

import React, { useEffect, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { GeoArrowScatterplotLayer } from "@geoarrow/deck.gl-layers";
import * as arrow from "apache-arrow";
import {ScatterplotLayer} from '@deck.gl/layers';
import {ArrowLoader} from '@loaders.gl/arrow';
import {load} from '@loaders.gl/core';


export default function Root() {

  const [table, setTable] = useState(null);

  useEffect(() => {
    // Fetch the data from the server
    // declare the data fetching function
    const fetchData = async () => {
      // const data = await fetch("http://localhost:3000/pressure_profiles.arrow");
      const data = await load("http://localhost:3000/calipso_backscatter_3d.feather", ArrowLoader);
      setTable(data);
    };

    if (!table) {
      fetchData().catch(console.error);
    }
  });


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
  })
  ];

  table &&
    layers.push(
      new ScatterplotLayer({
        id: "geoarrow-points",
        data: table,
        // getPosition: table.getChild("geometry"),
        getPosition: d => [d.longitude, d.latitude, d.altitude_km * 1000],
        getFillColor: d => {
          const val = d.backscatter_532;
          const c = Math.min(255, val * 5000);
          return [c, 100, 255 - c];
        },
        radiusMinPixels: 4,
        getPointRadius: 10,
        pointRadiusMinPixels: 0.8,
      }),
    );

  return (
    <DeckGL
      initialViewState={{
        longitude: -177.5, // Change to your data's center if known
        latitude: -66,
        zoom: 1,
      }}
      controller={true}
      layers={layers}
    />
  );
}


// /* global document */
// const container = document.body.appendChild(document.createElement('div'));
// createRoot(container).render(<Root />);
