// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

export default `#version 300 es
#define SHADER_NAME simple-mesh-layer-vs

// Primitive attributes
in vec3 positions;
in vec3 normals;
in vec3 colors;
in vec2 texCoords;

// Instance attributes
in vec3 instancePositions;
in vec3 instancePositions64Low;
in vec4 instanceColors;
in vec3 instancePickingColors;
in vec3 instanceModelMatrixCol0;
in vec3 instanceModelMatrixCol1;
in vec3 instanceModelMatrixCol2;
in vec3 instanceTranslation;

// Outputs to fragment shader
out vec2 vTexCoord;
out vec3 cameraPosition;
out vec3 normals_commonspace;
out vec4 position_commonspace;
out vec4 vColor;

out vec3 vNormal;
out vec3 vPosition;
out float vSurgeDepth;

// Uniforms
uniform sampler2D surgeTexture;

// Simple noise function for random displacement
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float colorToSurgeHeight(vec3 color) {
  float r = color.r;
  float g = color.g;
  float b = color.b;

  // Convert feet to meters (1 foot = 0.3048 meters)
  float feetToMeters = 0.3048;

  // Calculate brightness to detect if there's any color (not transparent/black)
  float brightness = r + g + b;

  // No water if too dark
  if (brightness < 0.1) {
    return 0.0;
  }

  // Red: > 9 feet (check red first as it's most critical)
  if (r > 0.5 && g < 0.3 && b < 0.3) {
    return 10.5 * feetToMeters; // ~3.2 meters
  }

  // Orange: > 6 feet
  if (r > 0.5 && g > 0.2 && g < 0.6 && b < 0.3) {
    return 7.5 * feetToMeters; // ~2.3 meters
  }

  // Yellow: > 3 feet
  if (r > 0.5 && g > 0.5 && b < 0.3) {
    return 4.5 * feetToMeters; // ~1.4 meters
  }

  // Bluish: < 3 feet (default for any other color)
  return 1.5 * feetToMeters; // ~0.5 meters
}

void main(void) {
  geometry.worldPosition = instancePositions;
  geometry.uv = texCoords;
  geometry.pickingColor = instancePickingColors;

  vTexCoord = texCoords;
  cameraPosition = project.cameraPosition;

  // ============================================
  // COMMENTED OUT: Surge texture sampling
  // ============================================
  // vec3 surgeColor = vec3(0.0);
  // float surgeDepth = 0.0;
  // if (surgeWater.hasSurgeData) {
  //   float minX = surgeWater.textureBounds.x;
  //   float minY = surgeWater.textureBounds.y;
  //   float maxX = surgeWater.textureBounds.z;
  //   float maxY = surgeWater.textureBounds.w;
  //   float lng = positions.x;
  //   float lat = positions.y;
  //   float u = (lng - minX) / (maxX - minX);
  //   float v = (lat - minY) / (maxY - minY);
  //   surgeColor = texture(surgeTexture, vec2(u, 1.0 - v)).rgb;
  //   surgeDepth = colorToSurgeHeight(surgeColor);
  // }

  vSurgeDepth = 0.0; // Not using for now

  // Simple base water color
  vColor = vec4(surgeWater.shallowWaterColor, surgeWater.opacity);

  // Get position in world space
  mat3 instanceModelMatrix = mat3(instanceModelMatrixCol0, instanceModelMatrixCol1, instanceModelMatrixCol2);
  vec3 pos = (instanceModelMatrix * positions) * simpleMesh.sizeScale + instanceTranslation;

  // ============================================
  // WATER RIPPLE EFFECT - Random Z displacement with per-vertex timing
  // ============================================
  float time = surgeWater.time;

  // Use the vertex position (geographic coordinates) for wave calculation
  float x = positions.x;
  float y = positions.y;

  // Create a unique random time offset for each vertex based on its position
  float vertexRandom = hash(vec2(x * 100.0, y * 100.0));
  float timeOffset = vertexRandom * 10.0; // Random phase offset per vertex

  // Each vertex uses its own time phase
  float vertexTime = time + timeOffset;

  // Scale up the coordinates to create visible wave patterns
  float scale = 2.0; // Adjust this to control turbulence density

  // Multiple layers of noise for Z displacement (height) only
  // Each layer uses the vertex's unique time
  float noiseZ1 = noise(vec2(x * scale + vertexTime * 0.3, y * scale - vertexTime * 0.25)) * 2.0 - 1.0;
  float noiseZ2 = noise(vec2(x * scale * 2.5 + vertexTime * 0.4, y * scale * 2.5 + vertexTime * 0.35)) * 2.0 - 1.0;
  float noiseZ3 = noise(vec2(x * scale * 4.0 - vertexTime * 0.5, y * scale * 4.0 + vertexTime * 0.45)) * 2.0 - 1.0;

  // Combine multiple noise layers for natural water movement
  float displaceZ = (noiseZ1 * 0.5 + noiseZ2 * 0.3 + noiseZ3 * 0.2) * surgeWater.waveHeight * 0.15;

  // Apply Z displacement only (X and Y stay constant)
  pos.z += displaceZ;

  vPosition = pos;

  // ============================================
  // NORMAL CALCULATION for lighting
  // ============================================
  // Sample nearby noise to compute surface normal
  float offset = 0.01;

  // Sample displacement at neighboring points using vertex-specific time
  float timeLeft = time + hash(vec2((x - offset) * 100.0, y * 100.0)) * 10.0;
  float timeRight = time + hash(vec2((x + offset) * 100.0, y * 100.0)) * 10.0;
  float timeDown = time + hash(vec2(x * 100.0, (y - offset) * 100.0)) * 10.0;
  float timeUp = time + hash(vec2(x * 100.0, (y + offset) * 100.0)) * 10.0;

  float zLeft = (noise(vec2((x - offset) * scale + timeLeft * 0.3, y * scale - timeLeft * 0.25)) * 2.0 - 1.0) * 0.5 +
                (noise(vec2((x - offset) * scale * 2.5 + timeLeft * 0.4, y * scale * 2.5 + timeLeft * 0.35)) * 2.0 - 1.0) * 0.3;

  float zRight = (noise(vec2((x + offset) * scale + timeRight * 0.3, y * scale - timeRight * 0.25)) * 2.0 - 1.0) * 0.5 +
                 (noise(vec2((x + offset) * scale * 2.5 + timeRight * 0.4, y * scale * 2.5 + timeRight * 0.35)) * 2.0 - 1.0) * 0.3;

  float zDown = (noise(vec2(x * scale + timeDown * 0.3, (y - offset) * scale - timeDown * 0.25)) * 2.0 - 1.0) * 0.5 +
                (noise(vec2(x * scale * 2.5 + timeDown * 0.4, (y - offset) * scale * 2.5 + timeDown * 0.35)) * 2.0 - 1.0) * 0.3;

  float zUp = (noise(vec2(x * scale + timeUp * 0.3, (y + offset) * scale - timeUp * 0.25)) * 2.0 - 1.0) * 0.5 +
              (noise(vec2(x * scale * 2.5 + timeUp * 0.4, (y + offset) * scale * 2.5 + timeUp * 0.35)) * 2.0 - 1.0) * 0.3;

  // Compute tangent vectors - reversed gradients to fix lighting direction
  vec3 tangentX = vec3(1.0, 0.0, (zLeft - zRight) * surgeWater.waveHeight * 0.15);
  vec3 tangentY = vec3(0.0, 1.0, (zDown - zUp) * surgeWater.waveHeight * 0.15);
  vNormal = normalize(cross(tangentX, tangentY));

  if (simpleMesh.composeModelMatrix) {
    DECKGL_FILTER_SIZE(pos, geometry);
    // using instancePositions as world coordinates
    // when using globe mode, this branch does not re-orient the model to align with the surface of the earth
    // call project_normal before setting position to avoid rotation
    normals_commonspace = project_normal(instanceModelMatrix * normals);
    geometry.worldPosition += pos;
    gl_Position = project_position_to_clipspace(pos + instancePositions, instancePositions64Low, vec3(0.0), position_commonspace);
    geometry.position = position_commonspace;
  }
  else {
    pos = project_size(pos);
    DECKGL_FILTER_SIZE(pos, geometry);
    gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, pos, position_commonspace);
    geometry.position = position_commonspace;
    normals_commonspace = project_normal(instanceModelMatrix * normals);
  }

  geometry.normal = normals_commonspace;
  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);

  DECKGL_FILTER_COLOR(vColor, geometry);
}
`;
