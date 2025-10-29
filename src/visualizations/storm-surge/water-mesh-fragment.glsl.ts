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
  geometry.uv = vTexCoord;

  // Use the normal from vertex shader
  vec3 N = normalize(vNormal);

  // Lighting direction (sun)
  vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));

  // View direction for specular
  vec3 viewDir = normalize(cameraPosition - vPosition);

  // Diffuse lighting
  float diffuse = max(dot(N, lightDir), 0.0);
  float ambient = 0.3; // Ambient light so we can see everything

  // Specular highlight - sharper and brighter
  vec3 halfVector = normalize(lightDir + viewDir);
  float specular = pow(max(dot(N, halfVector), 0.0), 64.0); // Higher power = sharper highlight

  // Fresnel effect (edges more reflective)
  float fresnel = pow(1.0 - max(dot(N, viewDir), 0.0), 4.0);

  // Use height-based coloring: peaks = shallow, valleys = deep
  // Use lighting intensity to determine peaks vs valleys
  float heightFactor = diffuse; // Bright areas are peaks, dark are valleys
  heightFactor = smoothstep(0.3, 0.7, heightFactor); // Sharp transition

  // Mix between deep (valleys) and shallow (peaks) based on lighting
  vec3 waterColor = mix(surgeWater.deepWaterColor, surgeWater.shallowWaterColor, heightFactor);

  // Apply lighting - color already incorporates height via diffuse
  vec3 finalColor = waterColor * ambient + waterColor; // Base color + some ambient
  finalColor += specular * vec3(1.0, 1.0, 1.0) * 2.0; // Bright white specular highlights
  finalColor += fresnel * vec3(0.7, 0.8, 0.9) * 0.5; // Sky reflection

  fragColor = vec4(finalColor, surgeWater.opacity);
}
`;
