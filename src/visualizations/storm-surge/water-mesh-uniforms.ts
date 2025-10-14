// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import {Texture} from '@luma.gl/core';
import type {ShaderModule} from '@luma.gl/shadertools';

const uniformBlock = `\
uniform surgeWaterUniforms {
  float time;
  float waveHeight;
  float waveFrequency;
  float opacity;
  vec3 shallowWaterColor;
  vec3 deepWaterColor;
  bool hasSurgeData;
} surgeWater;
`;

export type SurgeWaterProps = {
  time: number;
  waveHeight: number;
  waveFrequency: number;
  opacity: number;
  shallowWaterColor: [number, number, number];
  deepWaterColor: [number, number, number];
  hasSurgeData: boolean;
  surgeTexture: Texture;
};

export const surgeWaterUniforms = {
    name: 'surgeWater',
    vs: uniformBlock,
    fs: uniformBlock,
    uniformTypes: {
      time: 'f32',
      waveHeight: 'f32',
      waveFrequency: 'f32',
      opacity: 'f32',
      shallowWaterColor: 'vec3<f32>',
      deepWaterColor: 'vec3<f32>',
      hasSurgeData: 'f32',
    }
} as const satisfies ShaderModule<SurgeWaterProps>;
