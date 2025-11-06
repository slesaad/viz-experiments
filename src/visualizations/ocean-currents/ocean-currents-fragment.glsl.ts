export default `#version 300 es
#define SHADER_NAME ocean-currents-layer-fs

precision highp float;

in float vAge;
in float vColorValue;
in vec2 vTexCoord;

out vec4 fragColor;

vec3 getColorFromValue(float value) {
  // Normalize value based on range (min to max)
  float normalizedValue = (value - oceanCurrents.colorValueMin) / (oceanCurrents.colorValueMax - oceanCurrents.colorValueMin);
  normalizedValue = clamp(normalizedValue, 0.0, 1.0);

  // Interpolate between 4 color stops
  if (normalizedValue < 0.33) {
    float t = normalizedValue / 0.33;
    return mix(oceanCurrents.colorScale0, oceanCurrents.colorScale1, t);
  } else if (normalizedValue < 0.67) {
    float t = (normalizedValue - 0.33) / 0.34;
    return mix(oceanCurrents.colorScale1, oceanCurrents.colorScale2, t);
  } else {
    float t = (normalizedValue - 0.67) / 0.33;
    return mix(oceanCurrents.colorScale2, oceanCurrents.colorScale3, t);
  }
}

void main(void) {
  // Discard particles below threshold
  if (vColorValue < oceanCurrents.colorThreshold) {
    discard;
  }

  // Create circular particles
  // vTexCoord ranges from (0,0) to (1,1), center at (0.5, 0.5)
  vec2 coord = vTexCoord * 2.0 - 1.0;

  // Calculate distance from center for circular shape
  float dist = length(coord);

  // Discard pixels outside the circle
  if (dist > 1.0) {
    discard;
  }

  // Create smooth gradient from center to edges
  float alpha = 1.0 - smoothstep(0.0, 1.0, dist);

  // Apply age-based fade (fadeOpacity controls the strength of the fade)
  // Fade in at birth (age 0), stay visible, fade out before death (age 1)
  float ageFade = 1.0;
  if (vAge < 0.1) {
    ageFade = vAge / 0.1; // Fade in
  } else if (vAge > 0.9) {
    ageFade = (1.0 - vAge) / 0.1; // Fade out
  }
  alpha *= mix(1.0, ageFade, oceanCurrents.fadeOpacity);

  // Get color based on current value (SST)
  vec3 color = getColorFromValue(vColorValue);

  // Add soft glow in the center core
  float coreGlow = 1.0 - smoothstep(0.0, 0.3, dist);
  color += vec3(coreGlow * 0.3);

  // Overall opacity for smooth blending
  fragColor = vec4(color, alpha * 0.8);

  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;
