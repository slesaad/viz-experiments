/**
 * Wind Velocity Field Generator
 * Creates velocity fields from GEOS wind data (U and V components)
 */

import { VelocityField, VelocityFieldBounds } from './velocity-field';
import windData from './wind_data_us.json';

interface WindDataStructure {
  lats: number[];
  lons: number[];
  u: number[][]; // Eastward wind component
  v: number[][]; // Northward wind component
  metadata: {
    date: string;
    time: string;
    source: string;
    units: string;
    [key: string]: any;
  };
}

const typedWindData = windData as WindDataStructure;

/**
 * Generate velocity field from real wind data
 */
export function generateWindVelocityField(
  width: number,
  height: number,
  bounds: VelocityFieldBounds
): VelocityField {
  const { lats, lons, u, v } = typedWindData;

  const data = new Float32Array(width * height * 2);

  // Calculate step sizes
  const lonStep = (bounds.east - bounds.west) / width;
  const latStep = (bounds.north - bounds.south) / height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const lon = bounds.west + x * lonStep;
      const lat = bounds.south + y * latStep;

      // Sample wind components at this position
      const uWind = sampleWind(lon, lat, lons, lats, u);
      const vWind = sampleWind(lon, lat, lons, lats, v);

      // Wind data is already in m/s, scale for visualization
      // Scale down significantly since wind speeds are much higher than CO2 gradients
      const speedScale = 0.01; // Adjust this to control particle speed

      const idx = (y * width + x) * 2;
      data[idx] = uWind * speedScale;     // u velocity (eastward)
      data[idx + 1] = vWind * speedScale; // v velocity (northward)
    }
  }

  return {
    data,
    width,
    height,
  };
}

/**
 * Sample wind value at given lat/lon using bilinear interpolation
 */
function sampleWind(
  lon: number,
  lat: number,
  lons: number[],
  lats: number[],
  windGrid: number[][]
): number {
  // Find grid cell
  const lonIdx = findIndex(lons, lon);
  const latIdx = findIndex(lats, lat);

  if (lonIdx < 0 || lonIdx >= lons.length - 1 ||
      latIdx < 0 || latIdx >= lats.length - 1) {
    return 0; // Out of bounds
  }

  // Bilinear interpolation
  const lon0 = lons[lonIdx];
  const lon1 = lons[lonIdx + 1];
  const lat0 = lats[latIdx];
  const lat1 = lats[latIdx + 1];

  const fx = (lon - lon0) / (lon1 - lon0);
  const fy = (lat - lat0) / (lat1 - lat0);

  // Get wind values at four corners
  const w00 = windGrid[latIdx][lonIdx] || 0;
  const w10 = windGrid[latIdx][lonIdx + 1] || 0;
  const w01 = windGrid[latIdx + 1][lonIdx] || 0;
  const w11 = windGrid[latIdx + 1][lonIdx + 1] || 0;

  // Bilinear interpolation
  const w0 = w00 * (1 - fx) + w10 * fx;
  const w1 = w01 * (1 - fx) + w11 * fx;

  return w0 * (1 - fy) + w1 * fy;
}

/**
 * Find index in sorted array where value would be inserted
 */
function findIndex(arr: number[], value: number): number {
  for (let i = 0; i < arr.length - 1; i++) {
    if (value >= arr[i] && value < arr[i + 1]) {
      return i;
    }
  }
  return arr.length - 2; // Return second-to-last index
}

/**
 * Get wind data metadata
 */
export function getWindMetadata() {
  return typedWindData.metadata;
}

/**
 * Get raw wind data
 */
export function getWindData() {
  return {
    lats: typedWindData.lats,
    lons: typedWindData.lons,
    u: typedWindData.u,
    v: typedWindData.v,
    metadata: typedWindData.metadata
  };
}

/**
 * Sample wind components at normalized position [0, 1]
 */
export function sampleWindAtNormalizedPosition(
  x: number,
  y: number,
  bounds: VelocityFieldBounds
): { u: number; v: number; speed: number } {
  const lon = bounds.west + x * (bounds.east - bounds.west);
  const lat = bounds.south + y * (bounds.north - bounds.south);

  const u = sampleWind(lon, lat, typedWindData.lons, typedWindData.lats, typedWindData.u);
  const v = sampleWind(lon, lat, typedWindData.lons, typedWindData.lats, typedWindData.v);
  const speed = Math.sqrt(u * u + v * v);

  return { u, v, speed };
}

/**
 * Get wind speed range for color mapping
 */
export function getWindSpeedRange(): { min: number; max: number } {
  const { u, v } = typedWindData;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < u.length; i++) {
    for (let j = 0; j < u[i].length; j++) {
      const uVal = u[i][j];
      const vVal = v[i][j];
      const speed = Math.sqrt(uVal * uVal + vVal * vVal);

      if (speed > 0) {  // Skip zeros (missing data)
        min = Math.min(min, speed);
        max = Math.max(max, speed);
      }
    }
  }

  return { min, max };
}
