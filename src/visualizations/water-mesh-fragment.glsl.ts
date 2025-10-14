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

  vec4 color = simpleMesh.hasTexture ? texture(sampler, vTexCoord) : vec4(waterColor * (0.6 + 0.4 * diffuse), surgeWater.opacity);
  DECKGL_FILTER_COLOR(color, geometry);

  vec3 lightColor = lighting_getLightColor(color.rgb, cameraPosition, position_commonspace.xyz, N);
  fragColor = vec4(lightColor, color.a * layer.opacity);
}
`;
