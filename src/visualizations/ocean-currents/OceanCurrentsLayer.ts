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
import { oceanCurrentsUniforms, OceanCurrentsProps } from './ocean-currents-uniforms';
import vs from './ocean-currents-vertex.glsl';
import fs from './ocean-currents-fragment.glsl';

export type OceanParticleData = {
  position: [number, number, number];
  age: number;
  colorValue?: number; // SST or speed
  velocity?: [number, number];
};

export type OceanCurrentsLayerProps<DataT = OceanParticleData> = {
  data: DataT[];
  getPosition?: Accessor<DataT, [number, number, number]>;
  getAge?: Accessor<DataT, number>;
  getColorValue?: Accessor<DataT, number>;
  getVelocity?: Accessor<DataT, [number, number]>;
  particleSize?: number;
  fadeOpacity?: number;
  time?: number;
  colorScale?: [number, number, number][];
  colorValueRange?: { min: number; max: number };
  colorThreshold?: number;
} & LayerProps;

const defaultProps: DefaultProps<OceanCurrentsLayerProps> = {
  getPosition: { type: 'accessor', value: (d: OceanParticleData) => d.position },
  getAge: { type: 'accessor', value: (d: OceanParticleData) => d.age },
  getColorValue: { type: 'accessor', value: (d: OceanParticleData) => d.colorValue || 0 },
  getVelocity: { type: 'accessor', value: (d: OceanParticleData) => d.velocity || [0, 0] },
  particleSize: { type: 'number', value: 3.0, min: 0.1, max: 100 },
  fadeOpacity: { type: 'number', value: 1.0, min: 0, max: 1 },
  time: { type: 'number', value: 0 },
  colorScale: {
    type: 'array',
    value: [
      [0.1, 0.3, 0.8],  // Deep blue (cold)
      [0.2, 0.8, 0.9],  // Cyan
      [0.9, 0.9, 0.3],  // Yellow
      [1.0, 0.3, 0.1],  // Red-orange (warm)
    ],
    compare: false,
  },
  colorValueRange: { type: 'object', value: { min: 0, max: 1 }, compare: false },
  colorThreshold: { type: 'number', value: -999, min: -999, max: 999 },
};

export default class OceanCurrentsLayer<DataT = OceanParticleData> extends Layer<OceanCurrentsLayerProps<DataT>> {
  static layerName = 'OceanCurrentsLayer';
  static defaultProps = defaultProps;

  declare state: {
    model?: Model;
  };

  getShaders() {
    return super.getShaders({
      vs,
      fs,
      modules: [project32, picking, oceanCurrentsUniforms],
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
      instanceColorValue: {
        size: 1,
        type: 'float32',
        transition: true,
        accessor: 'getColorValue',
      },
      instanceVelocity: {
        size: 2,
        type: 'float32',
        transition: false,
        accessor: 'getVelocity',
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
      id: `${this.props.id}-ocean-particles`,
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
    const { particleSize, fadeOpacity, time, colorScale, colorValueRange, colorThreshold } = this.props;
    const { model } = this.state;

    if (!model) {
      return;
    }

    // Prepare uniform props
    const oceanCurrentsProps: OceanCurrentsProps = {
      particleSize: particleSize ?? 3.0,
      fadeOpacity: fadeOpacity ?? 1.0,
      time: time ?? 0.0,
      colorScale0: colorScale?.[0] ?? [0.1, 0.3, 0.8],
      colorScale1: colorScale?.[1] ?? [0.2, 0.8, 0.9],
      colorScale2: colorScale?.[2] ?? [0.9, 0.9, 0.3],
      colorScale3: colorScale?.[3] ?? [1.0, 0.3, 0.1],
      colorValueMin: colorValueRange?.min ?? 0,
      colorValueMax: colorValueRange?.max ?? 1,
      colorThreshold: colorThreshold ?? -999,
    };

    model.shaderInputs.setProps({
      oceanCurrents: oceanCurrentsProps,
    });

    model.draw(this.context.renderPass);
  }
}
