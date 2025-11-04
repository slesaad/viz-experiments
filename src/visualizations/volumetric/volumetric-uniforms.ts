import type { ShaderModule } from '@luma.gl/shadertools';

const uniformBlock = `\
uniform volumetricUniforms {
  float particleSize;
  float speedMin;
  float speedMax;
  vec4 colorLow;
  vec4 colorHigh;
} volumetric;
`;

export type VolumetricProps = {
  particleSize: number;
  colorLow: [number, number, number, number];
  colorHigh: [number, number, number, number];
  speedMin: number;
  speedMax: number;
};

export const volumetricUniforms: ShaderModule<VolumetricProps> = {
  name: 'volumetric',
  vs: uniformBlock,
  fs: uniformBlock,
  uniformTypes: {
    particleSize: 'f32',
    colorLow: 'vec4<f32>',
    colorHigh: 'vec4<f32>',
    speedMin: 'f32',
    speedMax: 'f32',
  },
};
