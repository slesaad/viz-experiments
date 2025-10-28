// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import type {ShaderModule} from '@luma.gl/shadertools';

const uniformBlock = `\
uniform particleAdvectionUniforms {
  float particleSize;
  float fadeOpacity;
  float time;
  vec3 colorScale0;
  vec3 colorScale1;
  vec3 colorScale2;
} particleAdvection;
`;

export type ParticleAdvectionProps = {
  particleSize: number;
  fadeOpacity: number;
  time: number;
  colorScale0: [number, number, number];
  colorScale1: [number, number, number];
  colorScale2: [number, number, number];
};

export const particleAdvectionUniforms = {
  name: 'particleAdvection',
  vs: uniformBlock,
  fs: uniformBlock,
  uniformTypes: {
    particleSize: 'f32',
    fadeOpacity: 'f32',
    time: 'f32',
    colorScale0: 'vec3<f32>',
    colorScale1: 'vec3<f32>',
    colorScale2: 'vec3<f32>',
  }
} as const satisfies ShaderModule<ParticleAdvectionProps>;
