import { useMemo } from 'react';
import {DeckGL} from '@deck.gl/react';
import {BitmapLayer} from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import ThreeLayer from './ThreeLayer';
import * as THREE from 'three';

export default function App() {
  // Create Three.js scene within component lifecycle
  const scene = useMemo(() => {
    // Create a MUCH larger cube (10km x 10km x 10km) to be visible at zoom 11
    const geometry = new THREE.BoxGeometry(10000, 10000, 10000);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000, // Red for better visibility
    });
    const cube = new THREE.Mesh(geometry, material);

    const newScene = new THREE.Scene();
    newScene.add(cube);

    // Add ambient light for visibility (though BasicMaterial doesn't need it)
    const light = new THREE.AmbientLight(0xffffff, 1);
    newScene.add(light);

    return newScene;
  }, []);

  const layers = useMemo(() => [
    new TileLayer({
      id: 'base-map',
      data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: props => {
        const { boundingBox: bbox, content: image } = props.tile;

        if (!image) return null;

        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]]
        })
      }
    }),
    new ThreeLayer({
      id: 'SimpleMeshLayer',
      scene: scene,
      center: [-122.4, 37.74, 0]
    })
  ], [scene]);

  return <DeckGL
    initialViewState={{
      longitude: -122.4,
      latitude: 37.74,
      zoom: 11,
      pitch: 45, // Add pitch to see the cube from an angle
      bearing: 0
    }}
    controller
    layers={layers}
  />;
}