export default `#version 300 es
#define SHADER_NAME particle-advection-layer-fs

precision highp float;

in float vAge;
in float vCO2Value;
in vec2 vTexCoord;

out vec4 fragColor;

vec3 getColorFromValue(float value) {
  // Normalize value based on co2Range (min to max)
  float normalizedValue = (value - particleAdvection.co2Min) / (particleAdvection.co2Max - particleAdvection.co2Min);
  normalizedValue = clamp(normalizedValue, 0.0, 1.0);

  // Interpolate between 4 color stops
  if (normalizedValue < 0.33) {
    float t = normalizedValue / 0.33;
    return mix(particleAdvection.colorScale0, particleAdvection.colorScale1, t);
  } else if (normalizedValue < 0.67) {
    float t = (normalizedValue - 0.33) / 0.34;
    return mix(particleAdvection.colorScale1, particleAdvection.colorScale2, t);
  } else {
    float t = (normalizedValue - 0.67) / 0.33;
    return mix(particleAdvection.colorScale2, particleAdvection.colorScale3, t);
  }
}

void main(void) {
  // Create wispy elongated particles
  // vTexCoord ranges from (0,0) to (1,1), center at (0.5, 0.5)
  vec2 coord = vTexCoord * 2.0 - 1.0;

  // Use elongated distance calculation for wispy effect
  // Stronger falloff in y (width), softer in x (length)
  float distX = abs(coord.x);
  float distY = abs(coord.y);

  // Create elliptical shape
  float ellipseDist = distX * distX * 0.3 + distY * distY * 2.0;

  // Discard pixels outside the wisp shape
  if (ellipseDist > 1.0) {
    discard;
  }

  // Create wispy gradient: fade from center to edges
  // Stronger gradient along the length (x) for trail effect
  float alpha = 1.0 - smoothstep(0.0, 1.0, ellipseDist);

  // Add extra fade along x for trail effect (brighter at back, fading toward front)
  float trailFade = 1.0 - smoothstep(-0.8, 1.0, coord.x);
  alpha *= trailFade;

  // Apply age-based fade (fadeOpacity controls the strength of the fade)
  alpha *= mix(1.0, (1.0 - vAge), particleAdvection.fadeOpacity);

  // Get color based on CO2/wind value
  vec3 color = getColorFromValue(vCO2Value);

  // Add soft glow in the center core
  float coreGlow = 1.0 - smoothstep(0.0, 0.3, ellipseDist);
  color += vec3(coreGlow * 0.4);

  // Lower overall opacity for a more ethereal, wispy look
  fragColor = vec4(color, alpha * 0.6);

  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;
