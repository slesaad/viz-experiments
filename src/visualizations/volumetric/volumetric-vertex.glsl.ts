export default `#version 300 es
#define SHADER_NAME volumetric-3d-line-vertex

// Geometry attributes (line)
in vec3 positions;
in float lineT;

// Instance attributes (per-line)
in vec3 instancePositions;
in vec3 instanceVelocities;
in float instanceSpeeds;

out float vSpeed;
out float vT;

void main(void) {
  // Set geometry world position for picking
  geometry.worldPosition = instancePositions;

  // Pass data to fragment shader
  vSpeed = instanceSpeeds;
  vT = lineT;

  // Normalize velocity to get direction
  vec3 velocity = instanceVelocities;
  float speed = length(velocity);
  vec3 direction = speed > 0.001 ? normalize(velocity) : vec3(1.0, 0.0, 0.0);

  // Create rotation matrix to align line with velocity direction
  // Line points along +X axis by default, rotate to point along velocity
  vec3 xAxis = direction;
  vec3 up = abs(direction.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 yAxis = normalize(cross(up, xAxis));
  vec3 zAxis = cross(xAxis, yAxis);

  mat3 rotationMatrix = mat3(xAxis, yAxis, zAxis);

  // Scale line by speed and size parameter
  float lineScale = volumetric.particleSize;

  // Apply rotation and scale to line geometry
  vec3 rotatedPos = rotationMatrix * (positions * lineScale);

  // Offset from instance position
  vec3 worldPos = instancePositions + rotatedPos;

  // Project to clip space
  vec3 pos_commonspace = project_position(worldPos);
  vec4 pos_clipspace = project_common_position_to_clipspace(vec4(pos_commonspace, 1.0));

  gl_Position = pos_clipspace;
  geometry.position = vec4(pos_commonspace, 1.0);

  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
`;
