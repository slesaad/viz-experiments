// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import type {NumericArray} from '@math.gl/core';
import {AccessorFunction, DefaultProps} from '@deck.gl/core';
import {ScatterplotLayer, ScatterplotLayerProps} from '@deck.gl/layers';

import {animatedDotUniforms, AnimatedDotProps} from './animated-dot-layer-uniforms';

const defaultProps: DefaultProps<AnimatedDotLayerProps> = {
  currentTime: {type: 'number', value: 0, min: 0},
};

/** All properties supported by AnimatedDotLayer. */
export type AnimatedDotLayerProps<DataT = unknown> = _AnimatedDotLayerProps<DataT> & ScatterplotLayerProps<DataT>;

/** Properties added by AnimatedDotLayer. */
type _AnimatedDotLayerProps<DataT = unknown> = {
  /**
   * The current time of the frame.
   * @default 0
   */
  currentTime?: number;
};

/** Render animated paths that represent vehicle trips. */
export default class AnimatedDotLayer<DataT = any, ExtraProps extends {} = {}> extends ScatterplotLayer<
  DataT,
  Required<_AnimatedDotLayerProps<DataT>> & ExtraProps
> {
  static layerName = 'AnimatedDotLayer';
  static defaultProps = defaultProps;

  getShaders() {
    const shaders = super.getShaders();
    shaders.inject = {
      // Change color based on time
      'fs:DECKGL_FILTER_COLOR': `\
        float uTime = animatedDot.currentTime * 0.01;
        color.r = abs(sin(uTime));
        color.g = abs(sin(uTime + 2.0));
        color.b = abs(sin(uTime + 4.0));
      `
    };
    shaders.modules = [...shaders.modules, animatedDotUniforms];
    return shaders;
  }

  // initializeState() {
  //   super.initializeState();

  //   const attributeManager = this.getAttributeManager();
  //   attributeManager!.addInstanced({
  //     timestamps: {
  //       size: 1,
  //       accessor: 'getTimestamps',
  //       shaderAttributes: {
  //         instanceTimestamps: {
  //           vertexOffset: 0
  //         },
  //         instanceNextTimestamps: {
  //           vertexOffset: 1
  //         }
  //       }
  //     }
  //   });
  // }

  draw(params) {
    const {currentTime} = this.props;
    const dotProps: AnimatedDotProps = { currentTime};
    console.log(currentTime)
    const model = this.state.model!;
    model.shaderInputs.setProps({animatedDot: dotProps});
    super.draw(params);
  }
}