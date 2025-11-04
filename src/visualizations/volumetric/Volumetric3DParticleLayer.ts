import {
  Layer,
  LayerProps,
  UpdateParameters,
  DefaultProps,
  project32,
  picking,
  Accessor,
} from '@deck.gl/core';
import { Model } from '@luma.gl/engine';
import { Geometry } from '@luma.gl/engine';
import { volumetricUniforms, VolumetricProps } from './volumetric-uniforms';
import vs from './volumetric-vertex.glsl';
import fs from './volumetric-fragment.glsl';

export type Particle3DData = {
  position: [number, number, number];
  velocity: [number, number, number];
  speed: number;
};

export type Volumetric3DParticleLayerProps<DataT = Particle3DData> = {
  data: DataT[];
  getPosition?: Accessor<DataT, [number, number, number]>;
  getVelocity?: Accessor<DataT, [number, number, number]>;
  getSpeed?: Accessor<DataT, number>;
  particleSize?: number;
  colorLow?: [number, number, number, number];
  colorHigh?: [number, number, number, number];
  speedRange?: [number, number];
} & LayerProps;

const defaultProps: DefaultProps<Volumetric3DParticleLayerProps> = {
  getPosition: { type: 'accessor', value: (d: Particle3DData) => d.position },
  getVelocity: { type: 'accessor', value: (d: Particle3DData) => d.velocity },
  getSpeed: { type: 'accessor', value: (d: Particle3DData) => d.speed },
  particleSize: { type: 'number', value: 10000.0, min: 1000, max: 100000 },
  colorLow: { type: 'color', value: [64, 128, 255, 200] },
  colorHigh: { type: 'color', value: [255, 64, 64, 200] },
  speedRange: { type: 'array', value: [0, 50], compare: true },
};

export default class Volumetric3DParticleLayer<DataT = Particle3DData> extends Layer<Volumetric3DParticleLayerProps<DataT>> {
  static layerName = 'Volumetric3DParticleLayer';
  static defaultProps = defaultProps;

  declare state: {
    model?: Model;
  };

  getShaders() {
    return super.getShaders({
      vs,
      fs,
      modules: [project32, picking, volumetricUniforms],
    });
  }

  initializeState(): void {
    this.getAttributeManager()!.addInstanced({
      instancePositions: {
        size: 3,
        type: 'float64',
        fp64: this.use64bitPositions(),
        transition: false,
        accessor: 'getPosition',
      },
      instanceVelocities: {
        size: 3,
        type: 'float32',
        transition: false,
        accessor: 'getVelocity',
      },
      instanceSpeeds: {
        size: 1,
        type: 'float32',
        transition: false,
        accessor: 'getSpeed',
      },
    });

    const model = this._getModel();
    this.setState({ model });
  }

  protected _getModel(): Model {
    // Create line geometry pointing along +X axis
    // Position t goes from 0 (start) to 1 (tip)
    const linePositions = new Float32Array([
      0.0, 0.0, 0.0,   // Start of line (t=0)
      1.0, 0.0, 0.0,   // End of line / tip (t=1)
    ]);

    const lineT = new Float32Array([
      0.0,  // Start
      1.0,  // Tip
    ]);

    const model = new Model(this.context.device, {
      ...this.getShaders(),
      id: `${this.props.id}-volumetric-lines`,
      bufferLayout: this.getAttributeManager()!.getBufferLayouts(),
      geometry: new Geometry({
        topology: 'line-list',
        attributes: {
          positions: { size: 3, value: linePositions },
          lineT: { size: 1, value: lineT },
        },
      }),
      isInstanced: true,
      parameters: {
        blend: true,
        blendColorOperation: 'add',
        blendColorSrcFactor: 'src-alpha',
        blendColorDstFactor: 'one-minus-src-alpha',
        blendAlphaOperation: 'add',
        blendAlphaSrcFactor: 'one',
        blendAlphaDstFactor: 'one-minus-src-alpha',
        depthWriteEnabled: true,
        depthCompare: 'less-equal',
      },
    });
    return model;
  }

  protected _destroyModel() {
    const { model } = this.state;
    model?.destroy();
    this.state.model = undefined;
  }

  updateState(params: UpdateParameters<this>): void {
    super.updateState(params);

    const { changeFlags } = params;

    if (changeFlags.extensionsChanged) {
      if (this.state.model) {
        this._destroyModel();
        this.state.model = this._getModel();
        this.getAttributeManager()!.invalidateAll();
      }
    }
  }

  draw(): void {
    const { particleSize, colorLow, colorHigh, speedRange } = this.props;
    const { model } = this.state;

    if (!model) return;

    const volumetricProps: VolumetricProps = {
      particleSize: particleSize ?? 8.0,
      colorLow: (colorLow ?? [64, 128, 255, 200]).map(c => c / 255) as [number, number, number, number],
      colorHigh: (colorHigh ?? [255, 64, 64, 200]).map(c => c / 255) as [number, number, number, number],
      speedMin: speedRange?.[0] ?? 0,
      speedMax: speedRange?.[1] ?? 50,
    };

    model.shaderInputs.setProps({
      volumetric: volumetricProps,
    });

    model.draw(this.context.renderPass);
  }
}
