// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import type {ShaderModule} from '@luma.gl/shadertools';

const uniformBlock = `\
uniform animatedDotUniforms {
  float currentTime;
} animatedDot;
`;

export type AnimatedDotProps = {
  currentTime: number;
};

export const animatedDotUniforms = {
  name: 'animatedDot',
  vs: uniformBlock,
  fs: uniformBlock,
  uniformTypes: {
    currentTime: 'f32',
  }
} as const satisfies ShaderModule<AnimatedDotProps>;