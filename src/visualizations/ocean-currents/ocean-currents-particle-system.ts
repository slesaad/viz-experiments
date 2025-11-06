/**
 * Ocean Currents Particle System
 * Manages particles that follow ocean current velocity fields
 */

import { VelocityField, sampleVelocity, VelocityFieldBounds } from './ocean-currents-velocity-field';

export interface OceanParticle {
  x: number; // normalized [0, 1]
  y: number; // normalized [0, 1]
  age: number; // in frames
  maxAge: number; // maximum age before reset (TTL)
  colorValue?: number; // value for coloring (SST or speed)
  vx: number; // velocity x component
  vy: number; // velocity y component
}

export interface OceanParticleSystemOptions {
  numParticles: number;
  bounds: VelocityFieldBounds;
  minAge?: number;
  maxAge?: number;
  speedMultiplier?: number;
}

export class OceanParticleSystem {
  particles: OceanParticle[];
  bounds: VelocityFieldBounds;
  minAge: number;
  maxAge: number;
  speedMultiplier: number;

  constructor(options: OceanParticleSystemOptions) {
    this.bounds = options.bounds;
    this.minAge = options.minAge || 50;
    this.maxAge = options.maxAge || 200;
    this.speedMultiplier = options.speedMultiplier || 1.0;
    this.particles = [];

    // Initialize particles with random positions
    for (let i = 0; i < options.numParticles; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle(): OceanParticle {
    return {
      x: Math.random(),
      y: Math.random(),
      age: Math.random() * this.maxAge, // Stagger initial ages
      maxAge: this.minAge + Math.random() * (this.maxAge - this.minAge),
      vx: 0,
      vy: 0,
    };
  }

  resetParticle(particle: OceanParticle): void {
    particle.x = Math.random();
    particle.y = Math.random();
    particle.age = 0;
    particle.maxAge = this.minAge + Math.random() * (this.maxAge - this.minAge);
    particle.vx = 0;
    particle.vy = 0;
  }

  update(
    velocityField: VelocityField,
    dt: number = 1.0,
    colorSampleFn?: (x: number, y: number) => number
  ): void {
    for (const particle of this.particles) {
      // Sample velocity at particle position
      const [u, v] = sampleVelocity(velocityField, particle.x, particle.y);

      // Store velocity for rendering (for wispy trails)
      particle.vx = u;
      particle.vy = v;

      // Update position using Euler integration
      // Scale factor adjusted for ocean currents (typically in m/s)
      const speed = this.speedMultiplier * dt * 0.00001;
      particle.x += u * speed;
      particle.y += v * speed;

      // Wrap around boundaries for global ocean
      particle.x = ((particle.x % 1) + 1) % 1;
      particle.y = ((particle.y % 1) + 1) % 1;

      // Clamp latitude to avoid poles
      if (particle.y < 0.05) particle.y = 0.05; // Near south pole
      if (particle.y > 0.95) particle.y = 0.95; // Near north pole

      // Sample color value at new position (SST or speed)
      if (colorSampleFn) {
        particle.colorValue = colorSampleFn(particle.x, particle.y);
      } else {
        // Default: calculate speed from velocity
        particle.colorValue = Math.sqrt(u * u + v * v);
      }

      // Update age
      particle.age += 1;

      // Reset if too old (TTL expired)
      if (particle.age > particle.maxAge) {
        this.resetParticle(particle);
      }
    }
  }

  /**
   * Convert normalized positions to geographic coordinates
   */
  getPositions(): Float32Array {
    const positions = new Float32Array(this.particles.length * 3);

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      let lng = this.bounds.west + particle.x * (this.bounds.east - this.bounds.west);
      const lat = this.bounds.south + particle.y * (this.bounds.north - this.bounds.south);

      // Convert from 0-360 range to -180 to 180 range for deck.gl
      if (lng > 180) {
        lng -= 360;
      }

      positions[i * 3] = lng;
      positions[i * 3 + 1] = lat;
      positions[i * 3 + 2] = 0; // z altitude (sea level)
    }

    return positions;
  }

  /**
   * Get particle ages normalized to [0, 1]
   */
  getAges(): Float32Array {
    const ages = new Float32Array(this.particles.length);

    for (let i = 0; i < this.particles.length; i++) {
      ages[i] = this.particles[i].age / this.particles[i].maxAge;
    }

    return ages;
  }

  /**
   * Get particle velocities
   */
  getVelocities(): Float32Array {
    const velocities = new Float32Array(this.particles.length * 2);

    for (let i = 0; i < this.particles.length; i++) {
      velocities[i * 2] = this.particles[i].vx;
      velocities[i * 2 + 1] = this.particles[i].vy;
    }

    return velocities;
  }

  /**
   * Get particle color values (SST or speed)
   */
  getColorValues(): Float32Array {
    const colorValues = new Float32Array(this.particles.length);

    for (let i = 0; i < this.particles.length; i++) {
      colorValues[i] = this.particles[i].colorValue || 0;
    }

    return colorValues;
  }
}
