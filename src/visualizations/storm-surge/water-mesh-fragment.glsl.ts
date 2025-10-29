// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

export default `#version 300 es
#define SHADER_NAME simple-mesh-layer-fs

precision highp float;

uniform sampler2D sampler;

in vec2 vTexCoord;
in vec3 cameraPosition;
in vec3 normals_commonspace;
in vec4 position_commonspace;
in vec4 vColor;

in vec3 vNormal;
in vec3 vPosition;
// in float vSurgeDepth;

out vec4 fragColor;

// Tiny high-frequency shimmer using sin — no geometry movement
float shimmer(vec2 p) {
  return sin(p.x * 60.0 + surgeWater.time * 8.0) * cos(p.y * 60.0 + surgeWater.time * 6.0);  // Y ripples
}

// Simple hash-based noise (cheap and branchless)
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
}

void main(void) {

  // World-space ripple pattern
  float ripple = sin(vPosition.x * surgeWater.waveFrequency + surgeWater.time * 0.5) * cos(vPosition.y * surgeWater.waveFrequency * 0.8 + surgeWater.time * 0.7);

  ripple *= surgeWater.waveHeight * 0.5; // control intensity

  // Blend ripple into water color
  float t = ripple * 0.5 + 0.5; // normalize [-1,1] to [0,1]
  vec3 waterColor = mix(surgeWater.deepWaterColor, surgeWater.shallowWaterColor, t);

  geometry.uv = vTexCoord;

  vec3 normal;
  if (simpleMesh.flatShading) {

  normal = normalize(cross(dFdx(position_commonspace.xyz), dFdy(position_commonspace.xyz)));
  } else {
    normal = normals_commonspace;
  }

  // Basic normal-based lighting
  vec3 N = normalize(vNormal);
  vec3 L = normalize(vec3(0.3, 0.5, 1.0)); // directional light
  float diffuse = max(dot(N, L), 0.0);
  float fresnel = pow(1.0 - max(dot(N, normalize(-vPosition)), 0.0), 3.0);

  // High-frequency ripples — tweak 20.0 / 40.0 to adjust scale/speed
  // float ripple = noise(vPosition.xy * 20.0 + surgeWater.time * 5.0) * 0.05; // Small amplitude
  // vec3 rippleColor = vec3(ripple);

  // Gentle glint — small amplitude, don't change whole surface
  float s = shimmer(vPosition.xy) * 0.015;
  // Blend
  vec3 finalColor = surgeWater.shallowWaterColor + vec3(s) + fresnel * 0.05;

  vec4 color = simpleMesh.hasTexture ? texture(sampler, vTexCoord) : vec4(finalColor, surgeWater.opacity);
  DECKGL_FILTER_COLOR(color, geometry);

  vec3 lightColor = lighting_getLightColor(color.rgb, cameraPosition, position_commonspace.xyz, N);
  fragColor = vec4(lightColor, color.a * layer.opacity);
  fragColor = vColor;
}
`;
