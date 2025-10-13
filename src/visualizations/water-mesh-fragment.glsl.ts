export default `
// deck.gl Water Effect Fragment Shader
// SPDX-License-Identifier: MIT
#version 300 es
#define SHADER_NAME surge-water-mesh-layer-fs

precision highp float;

// Uniform block for water properties
uniform surgeWaterUniforms {
  float time;
  float waveHeight;
  float waveFrequency;
  float opacity;
  vec3 shallowWaterColor;
  vec3 deepWaterColor;
  bool hasSurgeData;
} surgeWater;

uniform sampler2D surgeTexture;

// Inputs from vertex shader
in vec2 vTexCoord;
in vec3 cameraPosition;
in vec3 normals_commonspace;
in vec4 position_commonspace;
in vec4 vColor;
in float vWaveHeight;
in vec3 vWorldPosition;

out vec4 fragColor;

void main(void) {
  // Base water color interpolation based on depth/wave height
  float depthFactor = smoothstep(-surgeWater.waveHeight, surgeWater.waveHeight, vWaveHeight);
  vec3 waterColor = mix(surgeWater.deepWaterColor, surgeWater.shallowWaterColor, depthFactor);

  // Optional: Sample surge data texture if available
  float surgeIntensity = 1.0;
  if (surgeWater.hasSurgeData) {
    vec4 surgeData = texture(surgeTexture, vTexCoord);
    surgeIntensity = surgeData.r; // Assuming surge intensity is in red channel
    // Modulate water color based on surge data
    waterColor = mix(waterColor, surgeWater.deepWaterColor, surgeIntensity * 0.5);
  }

  // Calculate lighting
  vec3 normal = normalize(normals_commonspace);
  vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0)); // Directional light
  float diffuse = max(dot(normal, lightDir), 0.0);

  // Add ambient lighting
  float ambient = 0.4;
  float lighting = ambient + diffuse * 0.6;

  // Specular highlights (Phong)
  vec3 viewDir = normalize(cameraPosition - position_commonspace.xyz);
  vec3 reflectDir = reflect(-lightDir, normal);
  float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

  // Add foam at wave peaks
  float foamFactor = smoothstep(surgeWater.waveHeight * 0.6, surgeWater.waveHeight, vWaveHeight);
  vec3 foamColor = vec3(1.0, 1.0, 1.0);
  waterColor = mix(waterColor, foamColor, foamFactor * 0.3);

  // Fresnel effect for edge highlights
  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
  vec3 finalColor = waterColor * lighting + vec3(specular * 0.5) + vec3(fresnel * 0.2);

  // Apply opacity
  float finalOpacity = surgeWater.opacity * vColor.a;

  // Apply instance color tint
  finalColor *= vColor.rgb;

  fragColor = vec4(finalColor, finalOpacity);

  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;