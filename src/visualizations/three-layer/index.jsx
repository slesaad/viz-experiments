import { useMemo } from 'react';
import {DeckGL} from '@deck.gl/react';
import {BitmapLayer} from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import ThreeLayer from './ThreeLayer';
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

export default function App() {
  // Create Three.js scene within component lifecycle
  const scene = useMemo(() => {
    const newScene = new THREE.Scene();

    // Create water using Three.js Water module
    // PlaneGeometry is already in XY plane (Z-up), perfect for deck.gl!
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);

    // Load water normals texture
    const textureLoader = new THREE.TextureLoader();
    const waterNormals = textureLoader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/waternormals.jpg',
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }
    );

    // Create Water with Three.js Water module
    const water = new Water(waterGeometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: waterNormals,
      sunDirection: new THREE.Vector3(0.707, 0.707, 0).normalize(), // Sun in XY plane (not pointing up in Z)
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: false
    });

    // Patch the Water shader for Z-up coordinate system
    // The Water shader assumes Y-up world, but deck.gl is Z-up
    // Swap Y and Z coordinates in the Fresnel calculation
    const originalShader = water.material.fragmentShader;

    water.material.fragmentShader = originalShader.replace(
      'float theta = max( dot( toEye, normal ), 0.0 );',
      `// Swap Y and Z for Z-up coordinate system
      vec3 toEyeZUp = vec3(toEye.x, toEye.z, toEye.y);
      float theta = max( dot( toEyeZUp, normal ), 0.0 );`
    );
    water.material.needsUpdate = true;

    // No object rotation needed - geometry is already rotated
    water.position.set(0, 0, 0);

    newScene.add(water);

    // Add lighting for water
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    newScene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(1, 1, 1);
    newScene.add(sunLight);

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
      id: 'WaterLayer',
      scene: scene,
      center: [-122.4, 37.74, 0]
    })
  ], [scene]);

  return <DeckGL
    initialViewState={{
      longitude: -122.4,
      latitude: 37.74,
      zoom: 11,
      pitch: 45, // Add pitch to see the water from an angle
      bearing: 0
    }}
    controller
    layers={layers}
  />;
}