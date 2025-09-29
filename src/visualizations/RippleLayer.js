import {PolygonLayer} from '@deck.gl/layers';
import {project32, phongLighting} from '@deck.gl/core';

export default class WavePolygonLayer extends PolygonLayer {
  getShaders() {
    // Extend the default shaders with a custom module
    const shaders = super.getShaders();
    shaders.inject = {
      'vs:#decl': `
        uniform float uTime;
      `,
      'vs:#main-start': `
        // Add a sine wave effect to the elevation
        float wave = 5.0 * sin(0.1 * position.x + 0.1 * position.y + uTime * 2.0);
        position.z += wave;
      `
    };
    return shaders;
  }

//   draw({uniforms}) {
//     console.log(uniforms.uTime)
//     // Pass time uniform every frame
//     this.state.model.setUniforms({
//       uTime: uniforms.uTime || 0
//     });
//     super.draw({uniforms});
//   }
}
