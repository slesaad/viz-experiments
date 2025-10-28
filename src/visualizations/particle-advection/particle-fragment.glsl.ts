export default `#version 300 es
#define SHADER_NAME particle-advection-layer-fs

precision highp float;

in float vAge;
in vec2 vTexCoord;

out vec4 fragColor;

vec3 getColorFromAge(float age) {
  // Interpolate between color stops based on age
  if (age < 0.5) {
    float t = age * 2.0;
    return mix(particleAdvection.colorScale0, particleAdvection.colorScale1, t);
  } else {
    float t = (age - 0.5) * 2.0;
    return mix(particleAdvection.colorScale1, particleAdvection.colorScale2, t);
  }
}

void main(void) {
  // Create circular particles using texture coordinates
  // vTexCoord ranges from (0,0) to (1,1), center at (0.5, 0.5)
  vec2 coord = vTexCoord * 2.0 - 1.0;
  float dist = length(coord);

  // Discard pixels outside circle
  if (dist > 1.0) {
    discard;
  }

  // Smooth edge with antialiasing
  float alpha = 1.0 - smoothstep(0.7, 1.0, dist);

  // Apply age-based fade (fadeOpacity controls the strength of the fade)
  alpha *= mix(1.0, (1.0 - vAge), particleAdvection.fadeOpacity);

  // Get color based on age
  vec3 color = getColorFromAge(vAge);

  // Add slight glow in the center
  float glow = 1.0 - smoothstep(0.0, 0.5, dist);
  color += vec3(glow * 0.3);

  fragColor = vec4(color, alpha * 0.8);

  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;
