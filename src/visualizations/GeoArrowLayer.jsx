// GeoArrowMap.jsx
import React, { useEffect, useState } from "react";
import DeckGL from "@deck.gl/react";
import { GeoArrowLayer } from "@geoarrow/deck.gl-layers";
import { Table } from "apache-arrow";
import * as geoarrow from "@geoarrow/geoarrow-js";
import { fetchTable } from "@geoarrow/geoarrow-js/arrow";

const INITIAL_VIEW_STATE = {
  longitude: -95,
  latitude: 40,
  zoom: 3,
  pitch: 0,
  bearing: 0,
};

const GeoArrowMap = () => {
  const [layers, setLayers] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      // Adjust to where your .parquet file is hosted
      const response = await fetch("/assets/pressure_profiles.geoarrow.parquet");
      const table = await fetchTable(response);

      // Create the GeoArrowLayer
      const layer = new GeoArrowLayer({
        id: "geoarrow-layer",
        data: table,
        getFillColor: (d) => {
          const pressure = d.get("pressure");
          // Normalize pressure for color mapping (adjust this range)
          const color = Math.floor(((pressure - 900) / 200) * 255);
          return [255, 255 - color, 255 - color, 200]; // Pinkish heatmap
        },
        pointRadiusMinPixels: 2,
        getPointRadius: 4,
      });

      setLayers([layer]);
    };

    loadData();
  }, []);

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={layers}
    />
  );
};

export default GeoArrowMap;
