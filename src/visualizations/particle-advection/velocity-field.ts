/**
 * Velocity Field Generator
 * Creates a 2D velocity field for particle advection
 */

export interface VelocityField {
  width: number;
  height: number;
  data: Float32Array; // [u0, v0, u1, v1, ...] interleaved velocity components
}

export interface VelocityFieldBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Generate a fake velocity field with interesting flow patterns
 * This creates circular vortices and directional flows
 */
export function generateFakeVelocityField(
  width: number,
  height: number,
  bounds: VelocityFieldBounds,
  time: number = 0
): VelocityField {
  const data = new Float32Array(width * height * 2);

  // Create multiple vortex centers
  const vortices = [
    { x: 0.3, y: 0.5, strength: 0.8, clockwise: true },
    { x: 0.7, y: 0.5, strength: 0.6, clockwise: false },
    { x: 0.5, y: 0.3, strength: 0.4, clockwise: true },
  ];

  // Add some global wind
  const globalWindU = Math.sin(time * 0.0002) * 0.1;
  const globalWindV = Math.cos(time * 0.0003) * 0.1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 2;

      // Normalize coordinates to [0, 1]
      const nx = x / width;
      const ny = y / height;

      let u = globalWindU;
      let v = globalWindV;

      // Add contribution from each vortex
      for (const vortex of vortices) {
        const dx = nx - vortex.x;
        const dy = ny - vortex.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.001) {
          // Vortex strength falls off with distance
          const strength = vortex.strength * Math.exp(-dist * 3);
          const angle = Math.atan2(dy, dx);

          // Tangential velocity for circular motion
          const tangentAngle = angle + (vortex.clockwise ? Math.PI / 2 : -Math.PI / 2);
          u += Math.cos(tangentAngle) * strength / dist;
          v += Math.sin(tangentAngle) * strength / dist;
        }
      }

      // Add some turbulence
      const turbulence = 0.05;
      u += (Math.sin(nx * 20 + time * 0.0001) * Math.cos(ny * 15)) * turbulence;
      v += (Math.cos(nx * 15) * Math.sin(ny * 20 + time * 0.0001)) * turbulence;

      // Scale velocities to reasonable values
      const scale = 0.5;
      data[idx] = u * scale;
      data[idx + 1] = v * scale;
    }
  }

  return { width, height, data };
}

/**
 * Sample velocity at a normalized position [0, 1]
 */
export function sampleVelocity(
  field: VelocityField,
  nx: number,
  ny: number
): [number, number] {
  // Wrap coordinates
  nx = ((nx % 1) + 1) % 1;
  ny = ((ny % 1) + 1) % 1;

  // Bilinear interpolation
  const x = nx * (field.width - 1);
  const y = ny * (field.height - 1);

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, field.width - 1);
  const y1 = Math.min(y0 + 1, field.height - 1);

  const fx = x - x0;
  const fy = y - y0;

  const idx00 = (y0 * field.width + x0) * 2;
  const idx10 = (y0 * field.width + x1) * 2;
  const idx01 = (y1 * field.width + x0) * 2;
  const idx11 = (y1 * field.width + x1) * 2;

  const u00 = field.data[idx00];
  const v00 = field.data[idx00 + 1];
  const u10 = field.data[idx10];
  const v10 = field.data[idx10 + 1];
  const u01 = field.data[idx01];
  const v01 = field.data[idx01 + 1];
  const u11 = field.data[idx11];
  const v11 = field.data[idx11 + 1];

  const u0 = u00 * (1 - fx) + u10 * fx;
  const u1 = u01 * (1 - fx) + u11 * fx;
  const u = u0 * (1 - fy) + u1 * fy;

  const v0 = v00 * (1 - fx) + v10 * fx;
  const v1 = v01 * (1 - fx) + v11 * fx;
  const v = v0 * (1 - fy) + v1 * fy;

  return [u, v];
}
