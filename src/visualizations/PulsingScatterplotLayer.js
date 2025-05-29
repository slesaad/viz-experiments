import {ScatterplotLayer} from '@deck.gl/layers';

export default class PulsingScatterplotLayer extends ScatterplotLayer {
  static componentName = 'PulsingScatterplotLayer';

  getShaders() {
    return {
      ...super.getShaders(),
      inject: {
        'vs:#decl': `
          uniform float time;`,
        'vs:DECKGL_FILTER_SIZE': `
          float pulseEffect = 1.0 + 0.5 * sin(time * 5.0);
          size *= pulseEffect;`,
        'fs:#decl': `
          uniform float time;`,
        'fs:DECKGL_FILTER_COLOR': `
          color.r -= time;`,
      }
    };
  }

  draw({uniforms}) {
    super.draw({uniforms: {...uniforms, time: 0.9}});
  }
}

