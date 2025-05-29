import { createRoot } from 'react-dom/client';

import React, { useEffect, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { GeoArrowScatterplotLayer } from "@geoarrow/deck.gl-layers";
import * as arrow from "apache-arrow";


export default function Root() {

  const [table, setTable] = useState(null);

  useEffect(() => {
    // Fetch the data from the server
    // declare the data fetching function
    const fetchData = async () => {
      // const data = await fetch("http://localhost:3000/pressure_profiles.arrow");
      const data = await fetch("/assets/calipso_backscatter_3d.feather");
      // const data = await fetch("https://81d5-207-157-81-66.ngrok-free.app/points?minx=10&maxx=30&miny=10&maxy=30&minz=10&maxz=30&limit=10");

      const buffer = await data.arrayBuffer();
      const table = arrow.tableFromIPC(buffer);
      setTable(table);
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
      new GeoArrowScatterplotLayer({
        id: "geoarrow-points",
        data: table,
        // getPosition: table.getChild("geometry"),
        getPosition: table.getChild("geometry"),
        getFillColor: table.getChild("color"),
        // getFillColor: table.getChild("intensity").scale([0, 100], [0, 255]),
        radiusMinPixels: 4,
        getPointRadius: 10,
        pointRadiusMinPixels: 0.8,
      }),
    );

  return (
    <DeckGL
      initialViewState={{
        longitude: 0,
        latitude: 32,
        zoom: 1.5,
      }}
      controller={true}
      layers={layers}
    />
  );
}
