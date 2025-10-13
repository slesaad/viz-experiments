import { SimpleMeshLayer, SimpleMeshLayerProps } from '@deck.gl/mesh-layers';
import { AccessorFunction, DefaultProps } from '@deck.gl/core';
import { surgeWaterUniforms, SurgeWaterProps } from './water-mesh-uniforms';
import type {Texture} from '@luma.gl/core';

const vertexShader = `#version 300 es
#define SHADER_NAME surge-water-vertex

// These are provided by deck.gl automatically
in vec3 positions;
in vec3 normals;
in vec2 texCoords;
in vec3 instancePositions;
in vec3 instancePositions64Low;

uniform sampler2D surgeTexture;

out vec2 vTexCoord;
out vec3 vNormal;
out vec3 vPosition;
out float vSurgeDepth;
out vec3 vColor;

float colorToSurgeHeight(vec3 color) {
  float r = color.r;
  float g = color.g;
  float b = color.b;

  if (b > 0.7 && r < 0.4 && g < 0.6) return 0.45;
  if (r > 0.7 && g > 0.7 && b < 0.4) return 1.35;
  if (r > 0.7 && g > 0.4 && g < 0.8 && b < 0.4) return 2.25;
  if (r > 0.7 && g < 0.4 && b < 0.4) return 3.5;

  return 0.0;
}

void main() {
  vTexCoord = texCoords;

  vec3 surgeColor = vec3(0.0);
  float surgeDepth = 0.0;

  if (surgeWater.hasSurgeData) {
    surgeColor = texture(surgeTexture, texCoords).rgb;
    surgeDepth = colorToSurgeHeight(surgeColor);
  }

  vSurgeDepth = surgeDepth;
  vColor = surgeColor;

  // Start with mesh vertex position
  vec3 pos = positions;

  // Wave pattern
  float wave = 0.0;
  if (surgeDepth > 0.01) {
    wave = sin(pos.x * surgeWater.waveFrequency + surgeWater.time)
         * cos(pos.y * surgeWater.waveFrequency * 0.7 + surgeWater.time * 0.8);
    wave *= surgeWater.waveHeight;
  }

  // Apply surge depth and wave to z coordinate
  pos.z += surgeDepth + wave;

  // Apply instance position
  pos += instancePositions;

  vPosition = pos;

  // Calculate normal for lighting
  vec3 dx = vec3(1.0, 0.0, cos(pos.x * surgeWater.waveFrequency + surgeWater.time) * surgeWater.waveHeight);
  vec3 dy = vec3(0.0, 1.0, cos(pos.y * surgeWater.waveFrequency * 0.7 + surgeWater.time * 0.8) * surgeWater.waveHeight);
  vNormal = normalize(cross(dx, dy));

  // Use deck.gl projection
  gl_Position = project_common_position_to_clipspace(vec4(pos, 1.0));
}
`;

const fragmentShader = `#version 300 es
#define SHADER_NAME surge-water-fragment
precision highp float;

in vec2 vTexCoord;
in vec3 vNormal;
in vec3 vPosition;
in float vSurgeDepth;
in vec3 vColor;

out vec4 fragColor;

void main() {
  // Uncomment to hide non-surge areas
  // if (vSurgeDepth < 0.01) discard;

  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));
  float diffuse = max(dot(normal, lightDir), 0.0);

  vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);

  float depthFactor = clamp(vSurgeDepth / 3.0, 0.0, 1.0);
  vec3 color = mix(surgeWater.shallowWaterColor, surgeWater.deepWaterColor, depthFactor);

  // Mix in surge color for visualization
  color = mix(color, vColor, 0.15);

  // Specular highlights
  vec3 reflectDir = reflect(-lightDir, normal);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
  color = color * (0.5 + diffuse * 0.5) + vec3(spec * 0.6);
  color = mix(color, vec3(0.9, 0.95, 1.0), fresnel * 0.25);

  // Foam on waves
  float foam = smoothstep(0.15, 0.25, vPosition.z) * 0.4;
  color = mix(color, vec3(1.0), foam);

  float finalOpacity = surgeWater.opacity * (0.75 + depthFactor * 0.25);

  // Final color
  fragColor = vec4(color, finalOpacity);
}
`;

export type _SurgeWaterProps = SurgeWaterProps & SimpleMeshLayerProps;

export default class SurgeWaterLayer extends SimpleMeshLayer<_SurgeWaterProps> {
  getShaders() {
    // Get the parent shaders
    const shaders = super.getShaders();
    shaders.modules = [...shaders.modules, surgeWaterUniforms];
    // Inject custom shader code
    return {
      ...shaders,
      vs: vertexShader,
      fs: fragmentShader,
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
