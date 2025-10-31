export default `#version 300 es
#define SHADER_NAME particle-advection-layer-vs

// Geometry attributes (unit quad)
in vec3 positions;
in vec2 texCoords;

// Instance attributes (per-particle)
in vec3 instancePositions;
in float instanceAges;
in vec2 instanceVelocity;
in float instanceCO2;

out float vAge;
out float vCO2Value;
out vec2 vTexCoord;

void main(void) {
  // Set geometry world position for picking (use particle center)
  geometry.worldPosition = instancePositions;

  // Pass age, CO2 value, and tex coords to fragment shader
  vAge = instanceAges;
  vCO2Value = instanceCO2;
  vTexCoord = texCoords;

  // Calculate size factor based on age
  float sizeFactor = 1.0 - (vAge * 0.5); // Slightly smaller as they age
  float baseSize = particleAdvection.particleSize * sizeFactor;

  // Project particle center to common space and then to clip space
  vec3 center_commonspace = project_position(instancePositions);
  vec4 center_clipspace = project_common_position_to_clipspace(vec4(center_commonspace, 1.0));

  // Calculate velocity magnitude
  float speed = length(instanceVelocity);

  // Create wispy trail by stretching along velocity direction
  // Elongate in the direction of motion
  vec2 velocityDir = speed > 0.001 ? normalize(instanceVelocity) : vec2(1.0, 0.0);

  // Rotation matrix to align particle with velocity
  float angle = atan(velocityDir.y, velocityDir.x);
  float cosA = cos(angle);
  float sinA = sin(angle);
  mat2 rotation = mat2(cosA, -sinA, sinA, cosA);

  // Stretch factor: make particles longer based on speed
  float stretchFactor = 1.0 + speed * 5.0; // Adjust multiplier for more/less stretch
  vec2 stretchedPos = positions.xy;
  stretchedPos.x *= stretchFactor; // Elongate along x (will be rotated to velocity direction)

  // Apply rotation to align with velocity
  vec2 rotatedPos = rotation * stretchedPos;

  // Scale to pixels and then to NDC
  vec2 offset_pixels = rotatedPos * baseSize;
  vec2 offset_ndc = offset_pixels / project.viewportSize * 2.0;

  // Apply offset in clip space (billboard effect)
  gl_Position = center_clipspace;
  gl_Position.xy += offset_ndc * center_clipspace.w;

  geometry.position = vec4(center_commonspace, 1.0);

  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
`;
