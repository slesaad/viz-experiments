/**
 * Ocean Currents Velocity Field
 * Loads and samples ocean velocity data from grid JSON
 */

export interface VelocityField {
  width: number;
  height: number;
  data: Float32Array; // [u0, v0, u1, v1, ...] interleaved velocity components
  bounds: VelocityFieldBounds;
}

export interface VelocityFieldBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface OceanCurrentsData {
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  dimensions: {
    width: number;
    height: number;
  };
  u: number[][];
  v: number[][];
  w?: number[][];
}

/**
 * Load velocity field from ocean currents grid JSON
 */
export async function loadOceanCurrentsVelocityField(): Promise<VelocityField> {
  const response = await fetch('/src/visualizations/ocean-currents/ocean_currents_grid.json');
  const oceanData: OceanCurrentsData = await response.json();

  const { width, height } = oceanData.dimensions;
  const bounds: VelocityFieldBounds = {
    west: oceanData.bounds.minLon,
    south: oceanData.bounds.minLat,
    east: oceanData.bounds.maxLon,
    north: oceanData.bounds.maxLat,
  };

  // Convert 2D arrays to interleaved Float32Array
  const data = new Float32Array(width * height * 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 2;
      data[idx] = oceanData.u[y][x];
      data[idx + 1] = oceanData.v[y][x];
    }
  }

  console.log('Loaded ocean currents velocity field:', {
    dimensions: `${width}x${height}`,
    bounds,
    dataSize: data.length,
  });

  return { width, height, data, bounds };
}

/**
 * Create velocity field from already loaded ocean currents data
 */
export function createVelocityField(oceanData: OceanCurrentsData): VelocityField {
  const { width, height } = oceanData.dimensions;
  const bounds: VelocityFieldBounds = {
    west: oceanData.bounds.minLon,
    south: oceanData.bounds.minLat,
    east: oceanData.bounds.maxLon,
    north: oceanData.bounds.maxLat,
  };

  // Convert 2D arrays to interleaved Float32Array
  const data = new Float32Array(width * height * 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 2;
      data[idx] = oceanData.u[y][x];
      data[idx + 1] = oceanData.v[y][x];
    }
  }

  return { width, height, data, bounds };
}

/**
 * Sample velocity at a normalized position [0, 1]
 * Uses bilinear interpolation for smooth velocity transitions
 */
export function sampleVelocity(
  field: VelocityField,
  nx: number,
  ny: number
): [number, number] {
  // Wrap coordinates for global ocean data
  nx = ((nx % 1) + 1) % 1;
  ny = ((ny % 1) + 1) % 1;

  // Convert normalized coordinates to field coordinates
  const x = nx * (field.width - 1);
  const y = ny * (field.height - 1);

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, field.width - 1);
  const y1 = Math.min(y0 + 1, field.height - 1);

  const fx = x - x0;
  const fy = y - y0;

  // Get indices for bilinear interpolation
  const idx00 = (y0 * field.width + x0) * 2;
  const idx10 = (y0 * field.width + x1) * 2;
  const idx01 = (y1 * field.width + x0) * 2;
  const idx11 = (y1 * field.width + x1) * 2;

  // Sample velocity components
  const u00 = field.data[idx00];
  const v00 = field.data[idx00 + 1];
  const u10 = field.data[idx10];
  const v10 = field.data[idx10 + 1];
  const u01 = field.data[idx01];
  const v01 = field.data[idx01 + 1];
  const u11 = field.data[idx11];
  const v11 = field.data[idx11 + 1];

  // Bilinear interpolation
  const u0 = u00 * (1 - fx) + u10 * fx;
  const u1 = u01 * (1 - fx) + u11 * fx;
  const u = u0 * (1 - fy) + u1 * fy;

  const v0 = v00 * (1 - fx) + v10 * fx;
  const v1 = v01 * (1 - fx) + v11 * fx;
  const v = v0 * (1 - fy) + v1 * fy;

  return [u, v];
}

/**
 * Sample speed (magnitude) at a normalized position
 */
export function sampleSpeed(
  field: VelocityField,
  nx: number,
  ny: number
): number {
  const [u, v] = sampleVelocity(field, nx, ny);
  return Math.sqrt(u * u + v * v);
}

/**
 * Calculate velocity field statistics
 */
export function getVelocityStatistics(field: VelocityField): {
  minSpeed: number;
  maxSpeed: number;
  meanSpeed: number;
} {
  let minSpeed = Infinity;
  let maxSpeed = -Infinity;
  let totalSpeed = 0;
  let count = 0;

  for (let i = 0; i < field.data.length; i += 2) {
    const u = field.data[i];
    const v = field.data[i + 1];
    const speed = Math.sqrt(u * u + v * v);

    if (speed < minSpeed) minSpeed = speed;
    if (speed > maxSpeed) maxSpeed = speed;
    totalSpeed += speed;
    count++;
  }

  return {
    minSpeed,
    maxSpeed,
    meanSpeed: totalSpeed / count,
  };
}
