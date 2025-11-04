export default `#version 300 es
#define SHADER_NAME volumetric-3d-particle-fragment
precision highp float;

in vec2 vTexCoord;
in float vSpeed;

out vec4 fragColor;

void main() {
  // Make particles circular
  float dist = length(vTexCoord - 0.5);
  if (dist > 0.5) discard;

  // Normalize speed for color mapping
  float t = clamp((vSpeed - volumetric.speedMin) / (volumetric.speedMax - volumetric.speedMin), 0.0, 1.0);
  vec4 color = mix(volumetric.colorLow, volumetric.colorHigh, t);

  // Soft edges
  float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
  color.a *= alpha;

  fragColor = color;
}
`;
