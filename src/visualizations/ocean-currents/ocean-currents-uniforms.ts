// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import type {ShaderModule} from '@luma.gl/shadertools';

const uniformBlock = `\
uniform oceanCurrentsUniforms {
  float particleSize;
  float fadeOpacity;
  float time;
  vec3 colorScale0;
  vec3 colorScale1;
  vec3 colorScale2;
  vec3 colorScale3;
  float speedMin;
  float speedMax;
  float speedThreshold;
} oceanCurrents;
`;

export type OceanCurrentsProps = {
  particleSize: number;
  fadeOpacity: number;
  time: number;
  colorScale0: [number, number, number];
  colorScale1: [number, number, number];
  colorScale2: [number, number, number];
  colorScale3: [number, number, number];
  speedMin: number;
  speedMax: number;
  speedThreshold: number;
};

export const oceanCurrentsUniforms = {
  name: 'oceanCurrents',
  vs: uniformBlock,
  fs: uniformBlock,
  uniformTypes: {
    particleSize: 'f32',
    fadeOpacity: 'f32',
    time: 'f32',
    colorScale0: 'vec3<f32>',
    colorScale1: 'vec3<f32>',
    colorScale2: 'vec3<f32>',
    colorScale3: 'vec3<f32>',
    speedMin: 'f32',
    speedMax: 'f32',
    speedThreshold: 'f32',
  }
} as const satisfies ShaderModule<OceanCurrentsProps>;
