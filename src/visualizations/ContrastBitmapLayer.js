import {BitmapLayer} from '@deck.gl/layers';

export default class ContrastBitmapLayer extends BitmapLayer {
  static componentName = 'ContrastBitmapLayer';

  getShaders() {
    return {
      ...super.getShaders(),
      inject: {
        'fs:#decl': `
          uniform float brightness;
          uniform float contrast;`,
        'fs:DECKGL_FILTER_COLOR': `
          float grayscale = (color.r + color.g + color.b) / 3.0 + brightness;
          float newGrayscale = (grayscale - 0.5) * contrast + 0.5;
          color.rgb *= grayscale == 0.0 ? newGrayscale : newGrayscale / grayscale;`
      }
    }
  }

  draw(opts) {
    const {brightness, contrast} = this.props;
    opts.uniforms.brightness = brightness;
    opts.uniforms.contrast = contrast;
    super.draw(opts);
  }
}

