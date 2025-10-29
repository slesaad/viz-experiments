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

float colorToSurgeHeight(vec3 color) {
  float r = color.r;
  float g = color.g;
  float b = color.b;

  float offset = 5.0;

  if (b > 0.7 && r < 0.4 && g < 0.6) return (0.0);
  if (r > 0.7 && g > 0.7 && b < 0.4) return (1.35 + offset);
  if (r > 0.7 && g > 0.4 && g < 0.8 && b < 0.4) return (2.25 + offset);
  if (r > 0.7 && g < 0.4 && b < 0.4) return (3.5 + offset);

  return 0.0;
}

void main(void) {
  geometry.worldPosition = instancePositions;
  geometry.uv = texCoords;
  geometry.pickingColor = instancePickingColors;

  vTexCoord = texCoords;

  vec3 surgeColor = vec3(0.0);
  float surgeDepth = 0.0;

  if (surgeWater.hasSurgeData) {
    // Map mesh geographic position to texture coordinates
    // textureBounds = vec4(minX, minY, maxX, maxY)
    float minX = surgeWater.textureBounds.x;
    float minY = surgeWater.textureBounds.y;
    float maxX = surgeWater.textureBounds.z;
    float maxY = surgeWater.textureBounds.w;

    // positions contains the geographic coordinates (lng, lat, z)
    float lng = positions.x;
    float lat = positions.y;

    // Calculate normalized texture coordinates based on position within texture bounds
    float u = (lng - minX) / (maxX - minX);
    float v = (lat - minY) / (maxY - minY);

    // Sample texture with corrected coordinates (flip Y for proper orientation)
    surgeColor = texture(surgeTexture, vec2(u, 1.0 - v)).rgb;
    surgeDepth = colorToSurgeHeight(surgeColor);
  }

  vSurgeDepth = surgeDepth;
  vColor = vec4(vec3(surgeColor), surgeWater.opacity);

  cameraPosition = project.cameraPosition;
  // vColor = vec4(colors * instanceColors.rgb, instanceColors.a);

  mat3 instanceModelMatrix = mat3(instanceModelMatrixCol0, instanceModelMatrixCol1, instanceModelMatrixCol2);
  vec3 pos = (instanceModelMatrix * positions) * simpleMesh.sizeScale + instanceTranslation;

  // Wave pattern
  float wave = 0.0;
  if (surgeDepth > 0.01) {
    wave = sin(pos.x * surgeWater.waveFrequency + surgeWater.time)
         * cos(pos.y * surgeWater.waveFrequency * 0.7 + surgeWater.time * 0.8);
    wave *= surgeWater.waveHeight;
  }

  // Apply surge depth and wave to z coordinate
  pos.z += surgeDepth + wave;
  vPosition = pos;

  // Calculate normal for lighting
  vec3 dx = vec3(1.0, 0.0, cos(pos.x * surgeWater.waveFrequency + surgeWater.time) * surgeWater.waveHeight);
  vec3 dy = vec3(0.0, 1.0, cos(pos.y * surgeWater.waveFrequency * 0.7 + surgeWater.time * 0.8) * surgeWater.waveHeight);
  vNormal = normalize(cross(dx, dy));

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
