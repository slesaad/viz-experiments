import { SimpleMeshLayer, SimpleMeshLayerProps } from '@deck.gl/mesh-layers';
import { AccessorFunction, DefaultProps } from '@deck.gl/core';
import { surgeWaterUniforms, SurgeWaterProps } from './water-mesh-uniforms';
import type { Texture } from '@luma.gl/core';
import vs from './water-mesh-vertex.glsl';
import fs from './water-mesh-fragment.glsl';

export type _SurgeWaterProps = SurgeWaterProps & SimpleMeshLayerProps;

export default class SurgeWaterLayer extends SimpleMeshLayer<_SurgeWaterProps> {
  getShaders() {
    // Get the parent shaders
    const shaders = super.getShaders();

    shaders.inject = {
      // 'vs:DECKGL_FILTER_GL_POSITION': `
      //   // Compute ripple displacement
      //   float ripple = sin(position.x * surgeWater.waveFrequency + surgeWater.time * 0.5) *
      //                  cos(position.y * surgeWater.waveFrequency + surgeWater.time * 0.5);
      //   // Apply wave height
      //   // gl_Position.z += ripple * surgeWater.waveHeight * 0.1;
      //   gl_Position.xyz += vec3(0.2, 0.5, 0.0);
      // `,
      // 'fs:#decl': `
      //   in vec3 ripplePos;
      // `,
      'fs:DECKGL_FILTER_COLOR': `
        // Recompute same ripple value in fragment to interpolate colors
        float ripple = sin(geometry.uv.x * surgeWater.waveFrequency + surgeWater.time * 0.5) *
                       cos(geometry.uv.y * surgeWater.waveFrequency + surgeWater.time * 0.5);

        // Mix shallow and deep colors based on wave
        vec3 waterColor = mix(vec3(surgeWater.deepWaterColor), vec3(surgeWater.shallowWaterColor), ripple * 0.5 + 0.5);

        color = vec4(waterColor, surgeWater.opacity);
      `
    }

    shaders.modules = [...shaders.modules, surgeWaterUniforms];
    // return shaders;
    // Inject custom shader code
    return {
      ...shaders,
      vs: vs,
      fs: fs,
    };
  }

  // Optional: Define uniforms that should be passed to shaders
  draw(params) {
    const { uniforms } = params;

    // Add your custom uniforms
    const surgeWaterProps: SurgeWaterProps = {
      time: this.props.time || 0,
      waveHeight: this.props.waveHeight || 0.15,
      waveFrequency: this.props.waveFrequency || 80,
      opacity: this.props.opacity || 0.8,
      shallowWaterColor: this.props.shallowWaterColor || [0.4, 0.75, 0.85],
      deepWaterColor: this.props.deepWaterColor || [0.1, 0.3, 0.5],
      hasSurgeData: !!this.props.surgeTexture,
      surgeTexture: this.props.surgeTexture as Texture,
      textureBounds: this.props.textureBounds || [0, 0, 0, 0],
    };

    const model = this.state.model!;
    model.shaderInputs.setProps({
      surgeWater: surgeWaterProps,
    });

    super.draw(params);
  }
}

// const defaultProps: DefaultProps<_SurgeWaterProps> = {
//   ...SimpleMeshLayer.defaultProps,
//   time: { type: 'number', value: 0 },
//   waveHeight: { type: 'number', value: 0.15 },
//   waveFrequency: { type: 'number', value: 80 },
//   shallowWaterColor: { type: 'array', value: [0.4, 0.75, 0.85] },
//   deepWaterColor: { type: 'array', value: [0.1, 0.3, 0.5] },
// };

SurgeWaterLayer.layerName = 'SurgeWaterLayer';
