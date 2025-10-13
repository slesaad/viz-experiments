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
      // 'vs:#decl': `\
      //   out vec2 vTexCoord;
      // `,
      // 'vs:#main-end': `\
      //   vTexCoord = uv;
      // `,
      'fs:#decl': `\
        uniform sampler2D surgeTexture;
      `,
      'fs:#main-end': `\
        vec4 texColor = texture(surgeTexture, vTexCoord);
        fragColor = vec4(255.0, 0.0, 0.0, 255.0);
        fragColor = texColor;
      `
    };

    // shaders.inject = {
    //   'vs:#main-end': `\
    //     // Calculate wave displacement
    //     vec3 waveDisplacement = calculateWaveDisplacement(pos, surgeWater.time);
    //     vec3 displacedPos = pos + waveDisplacement;

    //     // Store wave height for fragment shader
    //     vWaveHeight = waveDisplacement.z;
    //     vWorldPosition = displacedPos;

    //     // Project position
    //     vec3 projectedPosition = project_position(displacedPos);
    //     position_commonspace = vec4(projectedPosition, 1.0);
    //     gl_Position = project_common_position_to_clipspace(position_commonspace);

    //     geometry.position = position_commonspace;

    //     // Calculate modified normals for wave surface
    //     vec3 waveNormal = calculateWaveNormal(pos, surgeWater.time);
    //     normals_commonspace = project_normal(instanceModelMatrix * waveNormal);
    //     geometry.normal = normals_commonspace;
    //   `,
    //   'fs:#decl': `\
    //     in vec2 vTexCoord;
    //     in float vSurgeDepth;
    //     uniform sampler2D surgeTexture;
    //   `,
    //   'fs:DECKGL_FILTER_COLOR': `\
    //     vec3 texColor = texture(surgeTexture, vTexCoord).rgb;

    //     // Mix with existing color
    //     fragColor.rgb = mix(fragColor.rgb, texColor, 0.15);

    //     // Optionally modulate opacity by surge depth
    //     fragColor.a *= (0.75 + clamp(vSurgeDepth / 3.0, 0.0, 1.0) * 0.25);
    //   `,
    // };

    shaders.modules = [...shaders.modules, surgeWaterUniforms];
    // return shaders;
    // Inject custom shader code
    return {
      ...shaders,
      // vs: vs,
      // fs: fs,
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
