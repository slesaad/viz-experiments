export default `#version 300 es
#define SHADER_NAME ocean-currents-layer-vs

// Geometry attributes (unit quad)
in vec3 positions;
in vec2 texCoords;

// Instance attributes (per-particle)
in vec3 instancePositions;
in float instanceAges;
in vec2 instanceVelocity;
in float instanceColorValue;

out float vAge;
out float vColorValue;
out vec2 vTexCoord;

void main(void) {
  // Set geometry world position for picking (use particle center)
  geometry.worldPosition = instancePositions;

  // Pass age, color value, and tex coords to fragment shader
  vAge = instanceAges;
  vColorValue = instanceColorValue;
  vTexCoord = texCoords;

  // Calculate size factor based on age (fade in and out)
  float ageFade = 1.0 - abs(vAge - 0.5) * 2.0; // Peaks at 0.5, fades at 0 and 1
  float sizeFactor = mix(0.3, 1.0, ageFade); // Don't fully disappear
  float baseSize = oceanCurrents.particleSize * sizeFactor;

  // Project particle center to common space and then to clip space
  vec3 center_commonspace = project_position(instancePositions);
  vec4 center_clipspace = project_common_position_to_clipspace(vec4(center_commonspace, 1.0));

  // Create circular particles (no stretching or rotation)
  vec2 offset_pixels = positions.xy * baseSize;
  vec2 offset_ndc = offset_pixels / project.viewportSize * 2.0;

  // Apply offset in clip space (billboard effect)
  gl_Position = center_clipspace;
  gl_Position.xy += offset_ndc * center_clipspace.w;

  geometry.position = vec4(center_commonspace, 1.0);

  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
`;
