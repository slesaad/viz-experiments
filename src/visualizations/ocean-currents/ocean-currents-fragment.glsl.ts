export default `#version 300 es
#define SHADER_NAME ocean-currents-layer-fs

precision highp float;

in float vAge;
in float vSpeedValue;
in vec2 vTexCoord;

out vec4 fragColor;

vec3 getColorFromSpeed(float speed) {
  // Normalize speed based on speedRange (min to max)
  float normalizedSpeed = (speed - oceanCurrents.speedMin) / (oceanCurrents.speedMax - oceanCurrents.speedMin);
  normalizedSpeed = clamp(normalizedSpeed, 0.0, 1.0);

  // Interpolate between 4 color stops
  // Blue (slow) -> Cyan -> Yellow -> Red (fast)
  if (normalizedSpeed < 0.33) {
    float t = normalizedSpeed / 0.33;
    return mix(oceanCurrents.colorScale0, oceanCurrents.colorScale1, t);
  } else if (normalizedSpeed < 0.67) {
    float t = (normalizedSpeed - 0.33) / 0.34;
    return mix(oceanCurrents.colorScale1, oceanCurrents.colorScale2, t);
  } else {
    float t = (normalizedSpeed - 0.67) / 0.33;
    return mix(oceanCurrents.colorScale2, oceanCurrents.colorScale3, t);
  }
}

void main(void) {
  // Discard particles below velocity threshold
  if (vSpeedValue < oceanCurrents.speedThreshold) {
    discard;
  }

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
  float alpha = 1.0 - smoothstep(0.0, 1.0, ellipseDist);

  // Add extra fade along x for trail effect (brighter at back, fading toward front)
  float trailFade = 1.0 - smoothstep(-0.8, 1.0, coord.x);
  alpha *= trailFade;

  // Apply age-based fade (fadeOpacity controls the strength of the fade)
  // Fade in at birth (age 0), stay visible, fade out before death (age 1)
  float ageFade = 1.0;
  if (vAge < 0.1) {
    ageFade = vAge / 0.1; // Fade in
  } else if (vAge > 0.9) {
    ageFade = (1.0 - vAge) / 0.1; // Fade out
  }
  alpha *= mix(1.0, ageFade, oceanCurrents.fadeOpacity);

  // Get color based on current speed
  vec3 color = getColorFromSpeed(vSpeedValue);

  // Add soft glow in the center core
  float coreGlow = 1.0 - smoothstep(0.0, 0.3, ellipseDist);
  color += vec3(coreGlow * 0.3);

  // Lower overall opacity for a more ethereal, wispy look
  fragColor = vec4(color, alpha * 0.7);

  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;
