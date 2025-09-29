import React from 'react';
import {DeckGL} from '@deck.gl/react';
import {SimpleMeshLayer} from '@deck.gl/mesh-layers';
import {OBJLoader} from '@loaders.gl/obj';

import type {PickingInfo} from '@deck.gl/core';

type BartStation = {
  name: string;
  entries: number;
  exits: number;
  coordinates: [longitude: number, latitude: number];
};

export default function App() {
  const layer = new SimpleMeshLayer<BartStation>({
    id: 'SimpleMeshLayer',
    data: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/bart-stations.json',

    getColor: (d: BartStation) => [Math.sqrt(d.exits), 140, 0],
    getOrientation: (d: BartStation) => [0, Math.random() * 180, 0],
    getPosition: (d: BartStation) => d.coordinates,
    mesh: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/humanoid_quad.obj',
    sizeScale: 30,
    pickable: true,
    loaders: [OBJLoader]
  });

  return <DeckGL
    initialViewState={{
      longitude: -122.4,
      latitude: 37.74,
      zoom: 11
    }}
    controller
    getTooltip={({object}: PickingInfo<BartStation>) => object && object.name}
    layers={[layer]}
  />;
}