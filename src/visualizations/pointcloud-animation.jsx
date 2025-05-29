import { createRoot } from 'react-dom/client';

import React, { useEffect, useState, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { COORDINATE_SYSTEM } from '@deck.gl/core';
import { PointCloudLayer } from '@deck.gl/layers';


export default function Root() {
  const [time, setTime] = useState(0);
  const [allData, setAllData] = useState([]);

  // Animate time
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(prev => (prev < 100 ? prev + 1 : 0));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Load point cloud data and store it
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/pointcloud.json')
      .then(res => res.json())
      .then(setAllData);
  }, []);

  // Memoized filtered data based on current time
  const visibleData = useMemo(() => {
    const step = Math.floor(allData.length / 100);
    return allData.slice(0, step * time);
  }, [allData, time]);

  const layer = new PointCloudLayer({
    id: 'PointCloudLayer',
    data: visibleData,
    getColor: (d) => d.color,
    getNormal: (d) => d.normal,
    getPosition: (d) => d.position,
    pointSize: 2,
    coordinateOrigin: [-122.4, 37.74],
    coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
    pickable: true
  });

  return (
    <DeckGL
      initialViewState={{
        longitude: -122.4,
        latitude: 37.74,
        zoom: 13,
        pitch: 50,
        bearing: 0,
      }}
      controller
      getTooltip={({ object }) =>
        object && object.position.join(', ')
      }
      layers={[layer]}
    />
  );
}

/* global document */
// const container = document.body.appendChild(document.createElement('div'));
// createRoot(container).render(<Root />);
