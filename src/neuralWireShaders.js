/**
 * NEURAL WIRE GLSL SHADERS
 * 
 * Custom GLSL ShaderMaterials:
 *   - WIRE_VERT / WIRE_FRAG: LineSegments for primary, secondary, and mesh filaments.
 *     Features GPU vertex-displacement wave animation (uTime, primaryWave, secondaryWave, depthWave).
 *   - NODE_VERT / NODE_FRAG: Points for the 4-tier node nexus system.
 *     Features synchronous GPU wave displacement to stay locked to filaments.
 *   - PARTICLE_VERT / PARTICLE_FRAG: Points for the ambient floating particle field.
 */

export const WIRE_VERT = /* glsl */`
  attribute vec4  aColorWeights; // x:primary  y:secondary  z:accent  w:highlight
  attribute float aAlpha;
  attribute vec3  aBasePosition; // Animation origin
  attribute vec2  aUvParam;      // normalized (u,v) parametric coords
  attribute vec4  aMeta;         // x:sideSign  y:layerIndex  z:strandIndex  w:nexusFactor

  uniform vec3  uPrimaryColor;
  uniform vec3  uSecondaryColor;
  uniform vec3  uAccentColor;
  uniform vec3  uHighlightColor;
  uniform float uOpacity;
  uniform float uGlowIntensity;
  uniform float uLayerOpacityScale;

  // Wave animation uniforms
  uniform float uTime;
  uniform float uAnimationIntensity;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // GPU vertex displacement wave animation
    vec3 pos = aBasePosition;
    
    if (uAnimationIntensity > 0.001) {
      float u = aUvParam.x;
      float v = aUvParam.y;
      float sideSign = aMeta.x;
      float layerIndex = aMeta.y;
      
      // Anchor envelope — reduce movement near outer edge (u≈0) and fully extended inner endpoints (u≈1)
      float anchorFade = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.92, 1.0, u));
      
      // Primary slow wave (12s cycle) — continuous organic undulation
      float primaryPhase = u * 3.14159 * 1.8 + v * 2.2 + layerIndex * 0.6;
      float primaryWave = sin(uTime * 0.52 + primaryPhase);
      
      // Secondary harmonic (16s cycle) — adds natural variation
      float secondaryPhase = u * 3.14159 * 2.3 - v * 1.7;
      float secondaryWave = sin(uTime * 0.39 + secondaryPhase) * 0.4;
      
      // Vertical displacement (Y-axis)
      float yDisplacement = (primaryWave + secondaryWave) * anchorFade * uAnimationIntensity * 0.15;
      
      // Subtle depth movement (Z-axis) — slower phase
      float depthPhase = u * 3.14159 * 1.2 + v * 1.5 + layerIndex * 1.2;
      float depthWave = sin(uTime * 0.31 + depthPhase);
      float zDisplacement = depthWave * anchorFade * uAnimationIntensity * 0.08;
      
      pos.y += yDisplacement;
      pos.z += zDisplacement;
    }

    // Calibrated 3D depth-cueing across full [-3.5, +3.5] depth span
    float depthFactor = clamp((pos.z + 3.2) / 6.0, 0.0, 1.0);
    float depthNorm = smoothstep(0.0, 1.0, depthFactor);

    float accentW = clamp(aColorWeights.z, 0.0, 1.0);

    vec3 baseColor =
      uPrimaryColor   * aColorWeights.x +
      uSecondaryColor * aColorWeights.y +
      uAccentColor    * accentW;

    // Incandescent core brightening that preserves outer chromatic vibrance
    float highW = clamp(aColorWeights.w, 0.0, 1.5);
    vec3 cyanGlint = vec3(0.18, 0.70, 1.0);
    float coreTransition = clamp((highW - 0.22) * 1.5, 0.0, 1.0);
    vec3 coreHighlight = mix(cyanGlint, uHighlightColor, coreTransition);

    // Violet preservation on accent strands
    vec3 violetHighlight = vec3(0.78, 0.52, 1.0);
    vec3 coreHighlightAdjusted = mix(coreHighlight, violetHighlight, clamp(accentW * 0.90, 0.0, 0.90));

    vec3 blended = mix(baseColor, coreHighlightAdjusted, clamp(highW * 0.72, 0.0, 0.90));

    float nexusBoost = 1.0 + (clamp(aColorWeights.w, 0.0, 0.85) * 0.30 + aMeta.w * 0.18) * uGlowIntensity;
    vColor = blended * nexusBoost * mix(0.75, 1.20, depthNorm);
    vAlpha = clamp(
      aAlpha * uOpacity * uLayerOpacityScale * mix(0.60, 1.0, depthNorm),
      0.0, 1.0
    );

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const WIRE_FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    if (vAlpha <= 0.003) discard;
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

export const NODE_VERT = /* glsl */`
  attribute vec4  aColorWeights;
  attribute float aAlpha;
  attribute float aNodeSize;
  attribute float aNodeTier;   // 0:small  1:medium  2:highlight  3:bokeh
  attribute vec3  aBasePosition;
  attribute vec2  aUvParam;
  attribute vec4  aMeta;

  uniform vec3  uPrimaryColor;
  uniform vec3  uSecondaryColor;
  uniform vec3  uAccentColor;
  uniform vec3  uNodeColor;
  uniform vec3  uHighlightColor;
  uniform float uOpacity;
  uniform float uGlowIntensity;
  uniform float uPixelRatio;

  // Wave animation uniforms
  uniform float uTime;
  uniform float uAnimationIntensity;

  varying vec3  vColor;
  varying vec3  vCoreColor;
  varying float vAlpha;
  varying float vTier;

  void main() {
    // Synchronous GPU wave displacement matching filaments
    vec3 pos = aBasePosition;
    
    if (uAnimationIntensity > 0.001) {
      float u = aUvParam.x;
      float v = aUvParam.y;
      float sideSign = aMeta.x;
      float layerIndex = aMeta.y;
      
      float anchorFade = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.92, 1.0, u));
      
      float primaryPhase = u * 3.14159 * 1.8 + v * 2.2 + layerIndex * 0.6;
      float primaryWave = sin(uTime * 0.52 + primaryPhase);
      
      float secondaryPhase = u * 3.14159 * 2.3 - v * 1.7;
      float secondaryWave = sin(uTime * 0.39 + secondaryPhase) * 0.4;
      
      float yDisplacement = (primaryWave + secondaryWave) * anchorFade * uAnimationIntensity * 0.15;
      
      float depthPhase = u * 3.14159 * 1.2 + v * 1.5 + layerIndex * 1.2;
      float depthWave = sin(uTime * 0.31 + depthPhase);
      float zDisplacement = depthWave * anchorFade * uAnimationIntensity * 0.08;
      
      pos.y += yDisplacement;
      pos.z += zDisplacement;
    }

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);

    // Pulsating glow for nexus nodes
    float pulse = 1.0;
    if (uAnimationIntensity > 0.001) {
      float pulsePhase = aUvParam.x * 6.28318 + aUvParam.y * 3.14159 + aMeta.y * 1.57;
      pulse = 1.0 + 0.16 * sin(uTime * 2.1 + pulsePhase) * uAnimationIntensity;
    }

    // Depth-cue for node nexus system across full [-3.5, 3.5] range
    float depthFactor = clamp((pos.z + 3.2) / 6.0, 0.0, 1.0);
    float depthNorm = smoothstep(0.0, 1.0, depthFactor);

    vec3 chromatic =
      uNodeColor      * aColorWeights.x +
      uSecondaryColor * aColorWeights.y +
      uAccentColor    * clamp(aColorWeights.z, 0.0, 1.0);

    vColor     = chromatic * (1.15 + 0.25 * uGlowIntensity) * mix(0.75, 1.25, depthNorm);
    vCoreColor = uHighlightColor;
    vAlpha     = clamp(aAlpha * uOpacity * pulse * mix(0.60, 1.0, depthNorm), 0.0, 1.0);
    vTier      = aNodeTier;

    float ps = 340.0 / max(-mv.z, 1.0);
    float maxPointSize = aNodeTier > 1.5 ? 180.0 : 80.0;
    gl_PointSize = clamp(aNodeSize * ps * uPixelRatio * (0.90 + 0.10 * pulse) * mix(0.75, 1.15, depthNorm), 1.0, maxPointSize);
    gl_Position  = projectionMatrix * mv;
  }
`;

export const NODE_FRAG = /* glsl */`
  uniform float uGlowIntensity;

  varying vec3  vColor;
  varying vec3  vCoreColor;
  varying float vAlpha;
  varying float vTier;

  void main() {
    vec2  uv = gl_PointCoord * 2.0 - 1.0;
    vec2  uvAbs = abs(uv);
    float r2 = dot(uv, uv);

    if (vAlpha <= 0.003) discard;

    float intensity = 0.0;
    vec3  col = vColor;

    if (vTier < 0.5) {
      // Tier 0 — small soft synaptic point
      if (r2 > 1.0) discard;
      float core = exp(-r2 * 18.0) * 1.5;
      float halo = exp(-r2 * 4.0) * 0.45;
      intensity  = core + halo;
      col = mix(vColor, vCoreColor, clamp(core * 0.70, 0.0, 0.90));
    } else if (vTier < 1.5) {
      // Tier 1 — medium junction star twinkle
      if (r2 > 1.0) discard;
      float spike = (exp(-uvAbs.x * 16.0) * exp(-uvAbs.y * 2.2) + exp(-uvAbs.y * 16.0) * exp(-uvAbs.x * 2.2)) * 0.55 * uGlowIntensity;
      float core  = exp(-r2 * 20.0) * 2.0;
      float inner = exp(-r2 * 5.0) * 0.85;
      float outer = exp(-r2 * 1.8) * 0.45 * uGlowIntensity;
      intensity   = core + inner + outer + spike;
      col = mix(vColor, vCoreColor, clamp((core * 1.1 + spike * 0.85), 0.0, 0.96));
    } else if (vTier < 2.5) {
      // Tier 2 — signature brilliant optical starburst lens flare matching reference image
      if (max(uvAbs.x, uvAbs.y) > 1.0) discard;

      // Long horizontal and vertical diffraction rays smoothly tapering to edge
      float spikeH = exp(-uvAbs.y * 36.0) * pow(clamp(1.0 - uvAbs.x, 0.0, 1.0), 1.0) * 2.2;
      float spikeV = exp(-uvAbs.x * 36.0) * pow(clamp(1.0 - uvAbs.y, 0.0, 1.0), 1.0) * 1.6;

      // Subtle 45-degree diagonal glints (both diagonals forming crossing diffraction rays)
      vec2 diag = abs(vec2(uv.x + uv.y, uv.x - uv.y) * 0.7071);
      float diagEdge = clamp(1.0 - max(diag.x, diag.y), 0.0, 1.0);
      float spikeD1 = exp(-diag.x * 42.0) * pow(diagEdge, 1.2) * 0.75;
      float spikeD2 = exp(-diag.y * 42.0) * pow(diagEdge, 1.2) * 0.75;
      float spikeD = spikeD1 + spikeD2;

      float starFlare = (spikeH + spikeV + spikeD) * uGlowIntensity;

      // Concentric brilliant core and soft radiant bloom halo tapering smoothly to zero
      float bloomTaper = clamp(1.0 - r2, 0.0, 1.0);
      float core  = exp(-r2 * 36.0) * 3.4;
      float inner = exp(-r2 * 9.0) * 1.6;
      float bloom = exp(-r2 * 2.6) * 0.92 * uGlowIntensity * bloomTaper;
      float aura  = exp(-r2 * 0.90) * 0.38 * uGlowIntensity * bloomTaper;

      intensity   = (core + inner + bloom + aura) + starFlare;

      vec3 azureCyan = vec3(0.18, 0.70, 1.0);
      vec3 rayColor = mix(vColor, azureCyan, clamp(starFlare * 0.35 + inner * 0.65, 0.0, 0.88));
      col = mix(rayColor, vCoreColor, clamp(core * 1.30 + inner * 0.45, 0.0, 1.0));
    } else {
      // Tier 3 — soft celestial bokeh orb
      if (r2 > 1.0) discard;
      float disc = smoothstep(1.0, 0.05, sqrt(r2)) * exp(-r2 * 1.4);
      intensity  = disc * 0.6;
      col = vColor;
    }

    float a = clamp(intensity * vAlpha, 0.0, 1.0);
    if (a <= 0.003) discard;
    gl_FragColor = vec4(col, a);
  }
`;

export const PARTICLE_VERT = /* glsl */`
  attribute vec4  aColorWeights;
  attribute float aAlpha;
  attribute float aParticleSize;
  attribute vec3  aBasePosition;
  attribute vec2  aUvParam;

  uniform vec3  uParticleColor;
  uniform vec3  uSecondaryColor;
  uniform vec3  uAccentColor;
  uniform vec3  uHighlightColor;
  uniform float uOpacity;
  uniform float uGlowIntensity;
  uniform float uPixelRatio;

  // Wave animation uniforms
  uniform float uTime;
  uniform float uAnimationIntensity;

  varying vec3  vColor;
  varying vec3  vHighColor;
  varying float vAlpha;
  varying float vHighW;

  void main() {
    vec3 pos = aBasePosition;

    if (uAnimationIntensity > 0.001) {
      float floatPhase = aUvParam.x * 6.28318 + aUvParam.y * 3.14159 + abs(pos.x) * 0.45;
      float driftY = sin(uTime * 0.42 + floatPhase) * 0.06 * uAnimationIntensity;
      float driftZ = cos(uTime * 0.33 + floatPhase) * 0.05 * uAnimationIntensity;
      pos.y += driftY;
      pos.z += driftZ;
    }

    vec4 mv  = modelViewMatrix * vec4(pos, 1.0);

    float depthFactor = clamp((pos.z + 3.2) / 6.0, 0.0, 1.0);
    float depthNorm = smoothstep(0.0, 1.0, depthFactor);

    vec3 tint =
      uParticleColor  * aColorWeights.x +
      uSecondaryColor * aColorWeights.y +
      uAccentColor    * clamp(aColorWeights.z, 0.0, 0.70);

    float pHigh = clamp(aColorWeights.w, 0.0, 1.0);
    vec3 pCol = mix(tint, uHighlightColor, pHigh * 0.45);
    vColor  = pCol * (1.20 + 0.25 * uGlowIntensity) * mix(0.60, 1.25, depthNorm);
    vHighColor = uHighlightColor;
    vAlpha  = clamp(aAlpha * uOpacity * 1.22 * mix(0.55, 1.0, depthNorm), 0.0, 1.0);
    vHighW  = aColorWeights.w;

    float ps = 320.0 / max(-mv.z, 1.0);
    gl_PointSize = clamp(aParticleSize * ps * uPixelRatio * mix(0.70, 1.20, depthNorm), 1.5, 12.0);
    gl_Position  = projectionMatrix * mv;
  }
`;

export const PARTICLE_FRAG = /* glsl */`
  varying vec3  vColor;
  varying vec3  vHighColor;
  varying float vAlpha;
  varying float vHighW;

  void main() {
    vec2  uv = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    if (r2 > 1.0 || vAlpha <= 0.004) discard;

    float smoothTaper = clamp(1.0 - r2, 0.0, 1.0);
    float core  = exp(-r2 * 11.0) * 1.75;
    float halo  = exp(-r2 * 2.4) * 0.52 * smoothTaper;
    float prof  = (core + halo) * smoothTaper;
    float a     = clamp(prof * vAlpha, 0.0, 1.0);
    if (a <= 0.003) discard;

    vec3 col = mix(vColor, vHighColor, clamp(core * 0.70 * vHighW, 0.0, 0.80));
    gl_FragColor = vec4(col, a);
  }
`;
