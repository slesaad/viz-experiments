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
import { particleAdvectionUniforms, ParticleAdvectionProps } from './particle-advection-uniforms';
import vs from './particle-vertex.glsl';
import fs from './particle-fragment.glsl';

export type ParticleData = {
  position: [number, number, number];
  age: number;
  co2?: number;
};

export type ParticleAdvectionLayerProps<DataT = ParticleData> = {
  data: DataT[];
  getPosition?: Accessor<DataT, [number, number, number]>;
  getAge?: Accessor<DataT, number>;
  getCO2?: Accessor<DataT, number>;
  particleSize?: number;
  fadeOpacity?: number;
  time?: number;
  colorScale?: [number, number, number][];
  co2Range?: { min: number; max: number };
} & LayerProps;

const defaultProps: DefaultProps<ParticleAdvectionLayerProps> = {
  getPosition: { type: 'accessor', value: (d: ParticleData) => d.position },
  getAge: { type: 'accessor', value: (d: ParticleData) => d.age },
  getCO2: { type: 'accessor', value: (d: ParticleData) => d.co2 || 0 },
  particleSize: { type: 'number', value: 2.0, min: 0.1, max: 100 },
  fadeOpacity: { type: 'number', value: 1.0, min: 0, max: 1 },
  time: { type: 'number', value: 0 },
  colorScale: {
    type: 'array',
    value: [
      [0.2, 0.6, 1.0],  // Blue
      [0.4, 0.8, 1.0],  // Light blue
      [1.0, 1.0, 1.0],  // White
    ],
    compare: false,
  },
  co2Range: { type: 'object', value: { min: 0.0004, max: 0.00042 }, compare: false },
};

export default class ParticleAdvectionLayer<DataT = ParticleData> extends Layer<ParticleAdvectionLayerProps<DataT>> {
  static layerName = 'ParticleAdvectionLayer';
  static defaultProps = defaultProps;

  declare state: {
    model?: Model;
  };

  getShaders() {
    return super.getShaders({
      vs,
      fs,
      modules: [project32, picking, particleAdvectionUniforms],
    });
  }

  initializeState(): void {
    // Set up attribute manager for INSTANCED attributes (per-particle data)
    this.getAttributeManager()!.addInstanced({
      instancePositions: {
        size: 3,
        type: 'float64',
        fp64: this.use64bitPositions(),
        transition: true,
        accessor: 'getPosition',
      },
      instanceAges: {
        size: 1,
        type: 'float64',
        fp64: this.use64bitPositions(),
        transition: true,
        accessor: 'getAge',
      },
      instanceCO2: {
        size: 1,
        type: 'float32',
        transition: true,
        accessor: 'getCO2',
      },
    });

    const model = this._getModel();

    this.setState({ model });
  }

  protected _getModel(): Model {
    // Create a unit quad geometry for billboard particles
    // This quad will be drawn once per particle (instanced)
    const quadPositions = new Float32Array([
      -0.5, -0.5, 0,  // bottom-left
       0.5, -0.5, 0,  // bottom-right
      -0.5,  0.5, 0,  // top-left
       0.5,  0.5, 0,  // top-right
    ]);

    const quadTexCoords = new Float32Array([
      0, 0,  // bottom-left
      1, 0,  // bottom-right
      0, 1,  // top-left
      1, 1,  // top-right
    ]);

    const model = new Model(this.context.device, {
      ...this.getShaders(),
      id: `${this.props.id}-particles`,
      bufferLayout: this.getAttributeManager()!.getBufferLayouts(),
      geometry: new Geometry({
        topology: 'triangle-strip',
        attributes: {
          positions: { size: 3, value: quadPositions },
          texCoords: { size: 2, value: quadTexCoords },
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
        depthWriteEnabled: false,  // Don't write to depth buffer
        depthCompare: 'always',     // Always render on top
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

    const { props, changeFlags } = params;

    if (changeFlags.extensionsChanged) {
      if (this.state.model) {
        this._destroyModel();
        this.state.model = this._getModel();
        this.getAttributeManager()!.invalidateAll();
      }
    }
  }

  draw(): void {
    const { particleSize, fadeOpacity, time, colorScale, co2Range } = this.props;
    const { model } = this.state;

    if (!model) {
      return;
    }

    // Prepare uniform props
    const particleAdvectionProps: ParticleAdvectionProps = {
      particleSize: particleSize ?? 2.0,
      fadeOpacity: fadeOpacity ?? 1.0,
      time: time ?? 0.0,
      colorScale0: colorScale?.[0] ?? [0.3, 0.7, 1.0],
      colorScale1: colorScale?.[1] ?? [0.5, 0.9, 1.0],
      colorScale2: colorScale?.[2] ?? [1.0, 1.0, 1.0],
      colorScale3: colorScale?.[3] ?? [1.0, 0.5, 0.2],
      co2Min: co2Range?.min ?? 0.0004,
      co2Max: co2Range?.max ?? 0.00042,
    };

    model.shaderInputs.setProps({
      particleAdvection: particleAdvectionProps,
    });

    model.draw(this.context.renderPass);
  }
}
