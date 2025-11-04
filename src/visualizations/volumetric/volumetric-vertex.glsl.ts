export default `#version 300 es
#define SHADER_NAME volumetric-3d-particle-vertex

// Geometry attributes (unit quad)
in vec3 positions;
in vec2 texCoords;

// Instance attributes (per-particle)
in vec3 instancePositions;
in float instanceSpeeds;

out vec2 vTexCoord;
out float vSpeed;

void main(void) {
  // Set geometry world position for picking
  geometry.worldPosition = instancePositions;

  // Pass data to fragment shader
  vTexCoord = texCoords;
  vSpeed = instanceSpeeds;

  // Project particle center to common space and then to clip space
  vec3 center_commonspace = project_position(instancePositions);
  vec4 center_clipspace = project_common_position_to_clipspace(vec4(center_commonspace, 1.0));

  // Scale to pixels and then to NDC for billboard effect
  vec2 offset_pixels = positions.xy * volumetric.particleSize;
  vec2 offset_ndc = offset_pixels / project.viewportSize * 2.0;

  // Apply offset in clip space (billboard effect)
  gl_Position = center_clipspace;
  gl_Position.xy += offset_ndc * center_clipspace.w;

  // Set geometry position
  geometry.position = vec4(center_commonspace, 1.0);

  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
`;
