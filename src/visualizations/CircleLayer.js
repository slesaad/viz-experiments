import {ScatterplotLayer} from '@deck.gl/layers';

const SHAPES = {
  SQUARE: 0,
  DIAMOND: 1,
  CROSS: 2
}

export default class CircleLayer extends ScatterplotLayer {
  static componentName = 'CircleLayer';
  static layerName = 'CircleLayer' + Date.now()

  initializeState() {
    super.initializeState();
    this.getAttributeManager().addInstanced({
      instanceShapes: {
        size: 1,
        accessor: 'getShape'
      }
    })
  }

  getShaders() {
    return {
      ...super.getShaders(),
      inject: {
        'vs:#decl': `
          uniform vec2 fadeDistance;
          in float instanceShapes;
          out float vShape;
          out vec2 vUnitPosition; // position in [-1, 1] quad space
        `,
        'vs:#main-end': `
          vShape = instanceShapes;
          vUnitPosition = geometry.position.xy; // pass to fragment
        `,
        'fs:#decl': `
          in float vShape;
          uniform vec2 fadeDistance;
          in vec2 vUnitPosition; // received from vertex shader
          const int SHAPE_SQUARE = 0;
          const int SHAPE_DIAMOND = 1;
          const int SHAPE_CROSS = 2;
        `,
        'fs:DECKGL_FILTER_COLOR': `
          vec2 uv = abs(geometry.uv); // geometry.uv should be available in most layer shaders
          float d = length(vUnitPosition.xy);
          // color.a *= clamp((fadeDistance.y - d) / (fadeDistance.y - fadeDistance.x), 0.0, 1.0);
          color.a = clamp((100.0 - d) / 100.0, 0.0, 1.0);
          int shape = int(vShape);
          if (shape == SHAPE_SQUARE) {
              if (uv.x > 0.7 || uv.y > 0.7) discard;
          } else if (shape == SHAPE_DIAMOND) {
              if (uv.x + uv.y > 1.0) discard;
          } else if (shape == SHAPE_CROSS) {
              if (uv.x > 0.25 && uv.y > 0.25) discard;
          }
        `
      }
    }
  }

  draw(opts) {
    opts.uniforms.fadeDistance = this.props.fadeDistance;
    super.draw(opts)
  }
}

