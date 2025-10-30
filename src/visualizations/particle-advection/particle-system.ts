/**
 * Particle System for Advection
 * Manages particle positions and updates them based on velocity field
 */

import { VelocityField, sampleVelocity, VelocityFieldBounds } from './velocity-field';

export interface Particle {
  x: number; // normalized [0, 1]
  y: number; // normalized [0, 1]
  age: number; // in frames
  maxAge: number; // maximum age before reset
  co2Value?: number; // CO2 concentration at particle position
  vx: number; // velocity x component
  vy: number; // velocity y component
}

export interface ParticleSystemOptions {
  numParticles: number;
  bounds: VelocityFieldBounds;
  minAge?: number;
  maxAge?: number;
  speedMultiplier?: number;
}

export class ParticleSystem {
  particles: Particle[];
  bounds: VelocityFieldBounds;
  minAge: number;
  maxAge: number;
  speedMultiplier: number;

  constructor(options: ParticleSystemOptions) {
    this.bounds = options.bounds;
    this.minAge = options.minAge || 30;
    this.maxAge = options.maxAge || 120;
    this.speedMultiplier = options.speedMultiplier || 1.0;
    this.particles = [];

    // Initialize particles with random positions
    for (let i = 0; i < options.numParticles; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle(): Particle {
    return {
      x: Math.random(),
      y: Math.random(),
      age: 0,
      maxAge: this.minAge + Math.random() * (this.maxAge - this.minAge),
      vx: 0,
      vy: 0,
    };
  }

  resetParticle(particle: Particle): void {
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
    co2SampleFn?: (x: number, y: number) => number
  ): void {
    for (const particle of this.particles) {
      // Sample velocity at particle position
      const [u, v] = sampleVelocity(velocityField, particle.x, particle.y);

      // Store velocity for rendering (for wispy trails)
      particle.vx = u;
      particle.vy = v;

      // Update position using Euler integration
      const speed = this.speedMultiplier * dt * 0.001;
      particle.x += u * speed;
      particle.y += v * speed;

      // Wrap around boundaries
      particle.x = ((particle.x % 1) + 1) % 1;
      particle.y = ((particle.y % 1) + 1) % 1;

      // Sample CO2 value at new position if function provided
      if (co2SampleFn) {
        particle.co2Value = co2SampleFn(particle.x, particle.y);
      }

      // Update age
      particle.age += 1;

      // Reset if too old
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
      const lng = this.bounds.west + particle.x * (this.bounds.east - this.bounds.west);
      const lat = this.bounds.south + particle.y * (this.bounds.north - this.bounds.south);

      positions[i * 3] = lng;
      positions[i * 3 + 1] = lat;
      positions[i * 3 + 2] = 500; // altitude
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
   * Set CO2 values for all particles
   */
  setCO2Values(co2SampleFn: (x: number, y: number) => number): void {
    for (const particle of this.particles) {
      particle.co2Value = co2SampleFn(particle.x, particle.y);
    }
  }

  /**
   * Get particle CO2 values
   */
  getCO2Values(): Float32Array {
    const co2Values = new Float32Array(this.particles.length);

    for (let i = 0; i < this.particles.length; i++) {
      co2Values[i] = this.particles[i].co2Value || 0;
    }

    return co2Values;
  }

  /**
   * Get particle data for rendering with trails
   * Returns positions for current and previous frame
   */
  getTrailSegments(previousPositions?: Float32Array): {
    current: Float32Array;
    previous: Float32Array;
  } {
    const current = this.getPositions();

    // If we don't have previous positions, use current positions
    const previous = previousPositions || current;

    return { current, previous };
  }
}
