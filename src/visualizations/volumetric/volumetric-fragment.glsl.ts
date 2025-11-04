export default `#version 300 es
#define SHADER_NAME volumetric-3d-line-fragment
precision highp float;

in float vSpeed;
in float vT;

out vec4 fragColor;

void main() {
  // Normalize speed for color mapping along the line body
  float speedNorm = clamp((vSpeed - volumetric.speedMin) / (volumetric.speedMax - volumetric.speedMin), 0.0, 1.0);
  vec4 bodyColor = mix(volumetric.colorLow, volumetric.colorHigh, speedNorm);

  // Tip of the line (t close to 1.0) is red
  vec4 tipColor = vec4(1.0, 0.0, 0.0, 1.0);

  // Mix between body color and red tip based on position along line
  // Last 20% of line transitions to red
  float tipBlend = smoothstep(0.7, 1.0, vT);
  vec4 color = mix(bodyColor, tipColor, tipBlend);

  fragColor = color;
}
`;
