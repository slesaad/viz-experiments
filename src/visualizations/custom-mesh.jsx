import React from 'react';
import { DeckGL } from '@deck.gl/react';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { OBJLoader } from '@loaders.gl/obj';
import { PlaneGeometry, CubeGeometry } from '@luma.gl/engine';

const INITIAL_VIEW_STATE = {
    longitude: -81.5,
    latitude: 27.5,
    zoom: 12,
    pitch: 45,
    bearing: 0
};


export default function App() {
    const geometry = new PlaneGeometry({
        width: 100000, // ~100 km wide
        height: 100000,
        // nWidth: 1,
        // nHeight: 1
    });

    const meshLayer = new SimpleMeshLayer({
        id: 'florida-mesh',
        data: [0], // dummy data for single object
        mesh: geometry, //new CubeGeometry(),
        getPosition: d => [-81.5, 27.5, 0], // lon, lat, elevation
        getColor: [0, 128, 255],
        sizeScale: 1000,
        coordinateSystem: 1, // COORDINATE_SYSTEM.LNGLAT
        material: {
            ambient: 0.2,
            diffuse: 0.6,
            shininess: 32,
            specularColor: [60, 64, 70]
        },
        pickable: true,
        autoHighlight: true
    });


    return <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={[meshLayer]}
    />;
}