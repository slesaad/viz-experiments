export default `#version 300 es
#define SHADER_NAME particle-advection-layer-vs

// Geometry attributes (unit quad)
in vec3 positions;
in vec2 texCoords;

// Instance attributes (per-particle)
in vec3 instancePositions;
in float instanceAges;

out float vAge;
out vec2 vTexCoord;

void main(void) {
  // Set geometry world position for picking (use particle center)
  geometry.worldPosition = instancePositions;

  // Pass age and tex coords to fragment shader
  vAge = instanceAges;
  vTexCoord = texCoords;

  // Calculate size factor based on age
  float sizeFactor = 1.0 - (vAge * 0.5); // Slightly smaller as they age
  float size = particleAdvection.particleSize * sizeFactor;

  // Project particle center to common space and then to clip space
  vec3 center_commonspace = project_position(instancePositions);
  vec4 center_clipspace = project_common_position_to_clipspace(vec4(center_commonspace, 1.0));

  // Billboard: expand the quad in screen space
  // positions.xy ranges from -0.5 to 0.5, multiply by size
  // Scale to pixels and then to NDC (normalized device coordinates)
  vec2 offset_pixels = positions.xy * size;
  vec2 offset_ndc = offset_pixels / project.viewportSize * 2.0;

  // Apply offset in clip space (billboard effect)
  gl_Position = center_clipspace;
  gl_Position.xy += offset_ndc * center_clipspace.w;

  geometry.position = vec4(center_commonspace, 1.0);

  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
`;
