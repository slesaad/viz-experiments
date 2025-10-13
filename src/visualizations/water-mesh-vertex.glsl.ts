export default `
// deck.gl Water Effect Vertex Shader
// SPDX-License-Identifier: MIT
#version 300 es
#define SHADER_NAME surge-water-mesh-layer-vs

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

// Primitive attributes
in vec3 positions;
in vec3 normals;
in vec3 colors;
in vec2 texCoords;
in vec4 uvRegions;
in vec3 featureIdsPickingColors;

// Instance attributes
in vec4 instanceColors;
in vec3 instancePickingColors;
in vec3 instanceModelMatrixCol0;
in vec3 instanceModelMatrixCol1;
in vec3 instanceModelMatrixCol2;

// Outputs to fragment shader
out vec2 vTexCoord;
out vec3 cameraPosition;
out vec3 normals_commonspace;
out vec4 position_commonspace;
out vec4 vColor;
out float vWaveHeight; // Pass wave displacement to fragment shader
out vec3 vWorldPosition; // World position for depth calculation

vec2 applyUVRegion(vec2 uv) {
  #ifdef HAS_UV_REGIONS
    return fract(uv) * (uvRegions.zw - uvRegions.xy) + uvRegions.xy;
  #else
    return uv;
  #endif
}

// Generate wave displacement
vec3 calculateWaveDisplacement(vec3 pos, float time) {
  // Multiple wave directions for more natural look
  float wave1 = sin(pos.x * surgeWater.waveFrequency + time) * 
                cos(pos.y * surgeWater.waveFrequency * 0.7 + time * 0.8);
  
  float wave2 = sin(pos.x * surgeWater.waveFrequency * 1.3 - time * 1.2) * 
                cos(pos.y * surgeWater.waveFrequency * 0.9 - time * 0.9);
  
  float wave3 = sin((pos.x + pos.y) * surgeWater.waveFrequency * 0.5 + time * 0.5);
  
  // Combine waves
  float displacement = (wave1 + wave2 * 0.5 + wave3 * 0.3) * surgeWater.waveHeight;
  
  return vec3(0.0, 0.0, displacement);
}

// Calculate wave normal for lighting
vec3 calculateWaveNormal(vec3 pos, float time) {
  float epsilon = 0.1;
  
  // Sample neighboring points
  vec3 posX = pos + vec3(epsilon, 0.0, 0.0);
  vec3 posY = pos + vec3(0.0, epsilon, 0.0);
  
  vec3 dispCenter = calculateWaveDisplacement(pos, time);
  vec3 dispX = calculateWaveDisplacement(posX, time);
  vec3 dispY = calculateWaveDisplacement(posY, time);
  
  vec3 tangentX = normalize(vec3(epsilon, 0.0, dispX.z - dispCenter.z));
  vec3 tangentY = normalize(vec3(0.0, epsilon, dispY.z - dispCenter.z));
  
  return normalize(cross(tangentY, tangentX));
}

void main(void) {
  vec2 uv = applyUVRegion(texCoords);
  geometry.uv = uv;

  if (mesh.pickFeatureIds) {
    geometry.pickingColor = featureIdsPickingColors;
  } else {
    geometry.pickingColor = instancePickingColors;
  }

  mat3 instanceModelMatrix = mat3(instanceModelMatrixCol0, instanceModelMatrixCol1, instanceModelMatrixCol2);

  vTexCoord = uv;
  cameraPosition = project.cameraPosition;
  vColor = vec4(colors * instanceColors.rgb, instanceColors.a);

  // Apply instance transformation
  vec3 pos = (instanceModelMatrix * positions) * simpleMesh.sizeScale;
  
  // Calculate wave displacement
  vec3 waveDisplacement = calculateWaveDisplacement(pos, surgeWater.time);
  vec3 displacedPos = pos + waveDisplacement;
  
  // Store wave height for fragment shader
  vWaveHeight = waveDisplacement.z;
  vWorldPosition = displacedPos;
  
  // Project position
  vec3 projectedPosition = project_position(displacedPos);
  position_commonspace = vec4(projectedPosition, 1.0);
  gl_Position = project_common_position_to_clipspace(position_commonspace);

  geometry.position = position_commonspace;
  
  // Calculate modified normals for wave surface
  vec3 waveNormal = calculateWaveNormal(pos, surgeWater.time);
  normals_commonspace = project_normal(instanceModelMatrix * waveNormal);
  geometry.normal = normals_commonspace;

  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);

  #ifdef MODULE_PBRMATERIAL
    pbr_vPosition = geometry.position.xyz;
    #ifdef HAS_NORMALS
      pbr_vNormal = geometry.normal;
    #endif
    #ifdef HAS_UV
      pbr_vUV = uv;
    #else
      pbr_vUV = vec2(0., 0.);
    #endif
    geometry.uv = pbr_vUV;
  #endif

  DECKGL_FILTER_COLOR(vColor, geometry);
}
`;