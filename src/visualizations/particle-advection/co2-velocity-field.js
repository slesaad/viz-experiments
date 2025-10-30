import co2Data from './co2_data_us.json';

/**
 * Generate velocity field from CO2 concentration gradients
 * Particles flow from high CO2 to low CO2 areas
 */
export function generateCO2VelocityField(width, height, bounds) {
  const { lats, lons, co2, metadata } = co2Data;

  const field = new Float32Array(width * height * 2);

  // Calculate step sizes
  const lonStep = (bounds.east - bounds.west) / width;
  const latStep = (bounds.north - bounds.south) / height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const lon = bounds.west + x * lonStep;
      const lat = bounds.south + y * latStep;

      // Sample CO2 at current position and neighbors
      const co2Center = sampleCO2(lon, lat, lons, lats, co2);
      const co2East = sampleCO2(lon + lonStep, lat, lons, lats, co2);
      const co2West = sampleCO2(lon - lonStep, lat, lons, lats, co2);
      const co2North = sampleCO2(lon, lat + latStep, lons, lats, co2);
      const co2South = sampleCO2(lon, lat - latStep, lons, lats, co2);

      // Calculate gradients
      const gradX = (co2East - co2West) / (2 * lonStep);
      const gradY = (co2North - co2South) / (2 * latStep);

      // Convert gradients to velocity
      // Negative gradient = flow from high to low concentration
      // Scale factor to control speed
      const speedScale = 0.5;

      const idx = (y * width + x) * 2;
      field[idx] = -gradX * speedScale;     // u velocity
      field[idx + 1] = -gradY * speedScale; // v velocity
    }
  }

  return {
    data: field,
    width,
    height,
    bounds
  };
}

/**
 * Sample CO2 value at given lat/lon using bilinear interpolation
 */
function sampleCO2(lon, lat, lons, lats, co2Grid) {
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

  // Get CO2 values at four corners
  const c00 = co2Grid[latIdx][lonIdx] || 0;
  const c10 = co2Grid[latIdx][lonIdx + 1] || 0;
  const c01 = co2Grid[latIdx + 1][lonIdx] || 0;
  const c11 = co2Grid[latIdx + 1][lonIdx + 1] || 0;

  // Bilinear interpolation
  const c0 = c00 * (1 - fx) + c10 * fx;
  const c1 = c01 * (1 - fx) + c11 * fx;

  return c0 * (1 - fy) + c1 * fy;
}

/**
 * Find index in sorted array where value would be inserted
 */
function findIndex(arr, value) {
  for (let i = 0; i < arr.length - 1; i++) {
    if (value >= arr[i] && value < arr[i + 1]) {
      return i;
    }
  }
  return arr.length - 2; // Return second-to-last index
}

/**
 * Get CO2 data metadata
 */
export function getCO2Metadata() {
  return co2Data.metadata;
}

/**
 * Get raw CO2 data for visualization overlay
 */
export function getCO2Data() {
  return {
    lats: co2Data.lats,
    lons: co2Data.lons,
    values: co2Data.co2,
    metadata: co2Data.metadata
  };
}

/**
 * Sample CO2 value at normalized position [0, 1]
 */
export function sampleCO2AtNormalizedPosition(x, y, bounds) {
  const lon = bounds.west + x * (bounds.east - bounds.west);
  const lat = bounds.south + y * (bounds.north - bounds.south);

  return sampleCO2(lon, lat, co2Data.lons, co2Data.lats, co2Data.co2);
}

/**
 * Get CO2 value range for color mapping
 */
export function getCO2Range() {
  const { co2 } = co2Data;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < co2.length; i++) {
    for (let j = 0; j < co2[i].length; j++) {
      const val = co2[i][j];
      if (val > 0) {  // Skip zeros (missing data)
        min = Math.min(min, val);
        max = Math.max(max, val);
      }
    }
  }

  return { min, max };
}
