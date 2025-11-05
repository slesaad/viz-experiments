// three-layer.ts
import { Layer, LayerContext } from '@deck.gl/core';
import { Matrix4 } from '@math.gl/core';
import * as THREE from 'three';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';

type ThreeLayerProps = {
  scene: Scene;
  center: [number, number, number];
};

export default class ThreeLayer extends Layer<ThreeLayerProps> {
  static layerName = 'ThreeLayer';

  declare state: {
    renderer: WebGLRenderer;
    camera: PerspectiveCamera;
    animationFrame?: number;
  };

  initializeState(context: LayerContext): void {
    const gl = context.gl || (context as any).device?.gl;
    const renderer = new WebGLRenderer({
      canvas: gl.canvas,
      context: gl,
      antialias: true
    });
    renderer.autoClear = false;

    const camera = new THREE.PerspectiveCamera();
    // Camera position and view matrix are set via deck.gl's projection matrix

    this.setState({
      renderer,
      camera,
    });

    // Start animation loop to continuously update
    this.startAnimationLoop();
  }

  startAnimationLoop(): void {
    const animate = () => {
      // Trigger a redraw
      this.setNeedsRedraw();
      this.state.animationFrame = requestAnimationFrame(animate);
    };
    animate();
  }

  finalizeState(): void {
    // Stop animation loop
    if (this.state.animationFrame) {
      cancelAnimationFrame(this.state.animationFrame);
    }

    // Clean up Three.js resources
    if (this.state.renderer) {
      this.state.renderer.dispose();
    }
  }

  draw(): void {
    const viewport = this.context.viewport;
    const { camera, renderer } = this.state;

    // Calculate matrix to transform scene to common space
    const position = viewport.projectPosition(this.props.center);
    const scales = viewport.getDistanceScales(this.props.center);
    const modelMatrix = new Matrix4().translate(position).scale(scales.unitsPerMeter);

    // Calculate MVP matrix using viewport's view-projection matrix
    const viewProjectMatrix = new Matrix4(viewport.viewProjectionMatrix);
    const mvpMatrix = viewProjectMatrix.multiplyRight(modelMatrix);

    // Update time uniform for animated materials
    const currentTime = performance.now() * 0.001;
    this.props.scene.traverse((object: any) => {
      if (object.material && object.material.uniforms) {
        if (object.material.uniforms.time !== undefined) {
          object.material.uniforms.time.value = currentTime;
        }
      }
    });

    // Update camera projection matrix and render
    camera.projectionMatrix = new THREE.Matrix4().fromArray(mvpMatrix);
    camera.matrixAutoUpdate = false;
    renderer.resetState();
    renderer.render(this.props.scene, camera);
  }
}