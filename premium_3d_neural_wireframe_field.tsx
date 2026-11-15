/**
 * PROJECT: PREMIUM 3D NEURAL WIREFRAME FIELD (PHASE 1 — FINAL VISUAL REFINEMENT)
 * Standalone React Three Fiber / Three.js Procedural Graphics Implementation
 *
 * Compatibility:
 * - React 19.2.6
 * - Three.js ^0.184.0
 * - @react-three/fiber ^9.6.1
 *
 * Workspace File Mapping (Copy each section into `src/components/neural-wire/`):
 *   1. src/components/neural-wire/neuralWireTheme.js
 *   2. src/components/neural-wire/neuralWireMaterials.js
 *   3. src/components/neural-wire/neuralWireGeometry.js
 *   4. src/components/neural-wire/neuralWireParticles.js
 *   5. src/components/neural-wire/NeuralWireField.jsx
 *   6. src/components/neural-wire/NeuralWirePreview.jsx
 */

import React, { useMemo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/* ============================================================================
 * FILE 1: src/components/neural-wire/neuralWireTheme.js
 * Centralized dark-tech palette configuration & theme token resolver.
 * ========================================================================== */

export const DEFAULT_NEURAL_WIRE_THEME = Object.freeze({
  primaryWireColor: '#1ad0ff',     // Luminous electric cyan for primary optical-fiber filaments
  secondaryWireColor: '#1862ed',   // Vibrant electric-cobalt blue for secondary strands & mesh cells
  accentWireColor: '#b042ff',      // Vivid violet-magenta for selective accent filaments & mesh links
  nodeColor: '#72ecff',            // Crisp ice-cyan for small & medium mesh intersection nodes
  highlightNodeColor: '#f6fdff',   // Pure white-blue core for prominent focal highlight nodes
  particleColor: '#42b6ff',        // Luminous electric sky-blue for abundant micro-particles
  opacity: 1.0,                    // Master opacity multiplier
  glowIntensity: 1.0,              // Controlled optical luminance & halo intensity
});

/**
 * Merges user-supplied partial theme tokens with the default dark-tech palette
 * and converts color strings into THREE.Color instances for GPU uniforms.
 */
export function resolveNeuralWireTheme(customTheme = {}) {
  const merged = {
    ...DEFAULT_NEURAL_WIRE_THEME,
    ...(customTheme || {}),
  };

  return {
    raw: merged,
    colors: {
      primaryWire: new THREE.Color(merged.primaryWireColor),
      secondaryWire: new THREE.Color(merged.secondaryWireColor),
      accentWire: new THREE.Color(merged.accentWireColor),
      node: new THREE.Color(merged.nodeColor),
      highlightNode: new THREE.Color(merged.highlightNodeColor),
      particle: new THREE.Color(merged.particleColor),
    },
    opacity: THREE.MathUtils.clamp(Number(merged.opacity ?? 1.0), 0.0, 2.0),
    glowIntensity: THREE.MathUtils.clamp(Number(merged.glowIntensity ?? 1.0), 0.0, 2.5),
  };
}

/* ============================================================================
 * FILE 2: src/components/neural-wire/neuralWireMaterials.js
 * Custom GLSL ShaderMaterials with depth-cued luminance hierarchy, crisp
 * variable-width hero filament cores, 4-tier radial nodes, and visible micro-dust.
 * ========================================================================== */

const WIRE_VERTEX_SHADER = /* glsl */ `
  attribute vec4 aColorWeights; // x: primary, y: secondary, z: accent, w: highlight
  attribute float aAlpha;
  attribute vec3 aBasePosition;
  attribute vec2 aUvParam;      // x: normalized U [0..1], y: normalized V [0..1]
  attribute vec4 aMeta;         // x: sideSign, y: layerIndex, z: strandIndex, w: nexusFactor

  uniform vec3 uPrimaryColor;
  uniform vec3 uSecondaryColor;
  uniform vec3 uAccentColor;
  uniform vec3 uHighlightColor;
  uniform float uOpacity;
  uniform float uGlowIntensity;
  uniform float uLayerOpacityScale;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Phase 1 static vertex position; aBasePosition, aUvParam, and aMeta are preserved for Phase 2
    vec3 finalPos = position;

    // Perceptible 3D depth-cueing across overlapping Z layers
    float depthFactor = clamp((finalPos.z + 4.2) / 5.0, 0.34, 1.18);

    vec3 blendedColor =
      uPrimaryColor * aColorWeights.x +
      uSecondaryColor * aColorWeights.y +
      uAccentColor * aColorWeights.z +
      uHighlightColor * aColorWeights.w;

    // Preserve vivid violet-magenta hue when accent weight is present
    float accentDom = clamp(aColorWeights.z * 1.2, 0.0, 1.0);
    vec3 depthTinted = mix(
      uSecondaryColor * 0.78 + uAccentColor * 0.28,
      blendedColor,
      clamp(max(depthFactor, accentDom * 0.88), 0.40, 1.0)
    );

    float nexusBoost = 1.0 + (aColorWeights.w * 0.76 + aMeta.w * 0.40) * uGlowIntensity;
    vColor = depthTinted * nexusBoost * mix(0.78, 1.22, depthFactor);
    vAlpha = clamp(aAlpha * uOpacity * uLayerOpacityScale * mix(0.64, 1.0, depthFactor), 0.0, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
  }
`;

const WIRE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha <= 0.001) discard;
    gl_FragColor = vec4(vColor * vAlpha, vAlpha);
  }
`;

const HERO_RIBBON_VERTEX_SHADER = /* glsl */ `
  attribute vec4 aColorWeights; // x: primary, y: secondary, z: accent, w: highlight
  attribute float aAlpha;
  attribute float aCross;       // [-1..1] transverse cross-section coordinate
  attribute vec3 aBasePosition;
  attribute vec2 aUvParam;
  attribute vec4 aMeta;

  uniform vec3 uPrimaryColor;
  uniform vec3 uSecondaryColor;
  uniform vec3 uAccentColor;
  uniform vec3 uHighlightColor;
  uniform float uOpacity;
  uniform float uGlowIntensity;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vCross;
  varying float vHighlight;
  varying float vNexus;

  void main() {
    vec3 finalPos = position;

    vec3 blendedColor =
      uPrimaryColor * aColorWeights.x +
      uSecondaryColor * aColorWeights.y +
      uAccentColor * aColorWeights.z +
      uHighlightColor * aColorWeights.w;

    vColor = blendedColor;
    vAlpha = clamp(aAlpha * uOpacity, 0.0, 1.0);
    vCross = aCross;
    vHighlight = aColorWeights.w;
    vNexus = aMeta.w;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
  }
`;

const HERO_RIBBON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uHighlightColor;
  uniform float uGlowIntensity;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vCross;
  varying float vHighlight;
  varying float vNexus;

  void main() {
    float d = abs(vCross);
    if (d >= 1.0 || vAlpha <= 0.001) discard;

    // Crisp, clearly visible thin optical-fiber profile:
    // - Sharp 1.5-2px luminous core thread (exp(-d^2 * 95))
    // - Saturated cyan, ice-blue or violet inner fiber body (exp(-d^2 * 18))
    // - Restrained soft optical halo (exp(-d^2 * 4.5))
    float thinCore = exp(-d * d * 95.0) * 1.28;
    float innerSheath = exp(-d * d * 18.0) * (0.76 + 0.22 * vNexus);
    float outerHalo = exp(-d * d * 4.5) * (0.30 + 0.24 * vHighlight + 0.22 * vNexus) * uGlowIntensity;

    float profile = clamp(thinCore + innerSheath + outerHalo, 0.0, 1.0);

    // Preserve rich cyan, electric-blue, and violet-magenta color separation along the filament;
    // shift toward white-blue at the razor-thin fiber center and major nexus crossings
    float coreWhiteness = clamp(
      thinCore * (0.46 + 0.44 * vNexus + 0.20 * vHighlight) + innerSheath * 0.16 * vNexus,
      0.0,
      0.94
    );
    vec3 saturatedHue = vColor * (1.16 + 0.24 * uGlowIntensity);
    vec3 finalRgb = mix(saturatedHue, uHighlightColor * 1.18, coreWhiteness);
    float finalAlpha = clamp(vAlpha * profile, 0.0, 1.0);

    gl_FragColor = vec4(finalRgb * finalAlpha, finalAlpha);
  }
`;

const NODE_VERTEX_SHADER = /* glsl */ `
  attribute vec4 aColorWeights; // x: node/primary, y: secondary, z: accent, w: highlight
  attribute float aAlpha;
  attribute float aNodeSize;
  attribute float aNodeTier;    // 0: small, 1: medium, 2: highlight nexus, 3: depth bokeh / ambient glow
  attribute vec3 aBasePosition;
  attribute vec2 aUvParam;
  attribute vec4 aMeta;

  uniform vec3 uPrimaryColor;
  uniform vec3 uSecondaryColor;
  uniform vec3 uAccentColor;
  uniform vec3 uNodeColor;
  uniform vec3 uHighlightColor;
  uniform float uOpacity;
  uniform float uGlowIntensity;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying vec3 vCoreColor;
  varying float vAlpha;
  varying float vTier;

  void main() {
    vec3 finalPos = position;
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);

    vec3 baseTint =
      uNodeColor * aColorWeights.x +
      uSecondaryColor * aColorWeights.y +
      uAccentColor * aColorWeights.z +
      uHighlightColor * aColorWeights.w;

    vColor = baseTint;
    vCoreColor = uHighlightColor;
    vAlpha = clamp(aAlpha * uOpacity, 0.0, 1.0);
    vTier = aNodeTier;

    float perspectiveScale = 285.0 / max(-mvPosition.z, 1.0);
    gl_PointSize = clamp(aNodeSize * perspectiveScale * uPixelRatio, 4.5, 160.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const NODE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uGlowIntensity;

  varying vec3 vColor;
  varying vec3 vCoreColor;
  varying float vAlpha;
  varying float vTier;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    if (r2 > 1.0 || vAlpha <= 0.001) discard;
    float r = sqrt(r2);

    float intensity = 0.0;
    vec3 col = vColor;

    if (vTier < 0.5) {
      // Tier 0: Small crisp mesh intersection node — sharp white-cyan pinpoint + tight halo
      float core = exp(-r2 * 13.0) * 1.48;
      float halo = exp(-r2 * 3.4) * 0.54;
      intensity = core + halo;
      col = mix(vColor, vCoreColor, clamp(core * 0.76, 0.0, 0.95));
    } else if (vTier < 1.5) {
      // Tier 1: Medium branching junction node — bright luminous center + controlled radial halo
      float core = exp(-r2 * 22.0) * 1.75;
      float innerHalo = exp(-r2 * 5.2) * 0.80;
      float outerHalo = exp(-r2 * 1.9) * 0.32 * uGlowIntensity;
      intensity = core + innerHalo + outerHalo;
      col = mix(vColor, vCoreColor, clamp(core * 0.86, 0.0, 0.97));
    } else if (vTier < 2.5) {
      // Tier 2: Highlight nexus node — crisp white-blue center + smooth circular cyan/violet glow
      float core = exp(-r2 * 40.0) * 2.25;
      float innerBloom = exp(-r2 * 9.8) * 1.15;
      float midBloom = exp(-r2 * 2.9) * 0.56 * uGlowIntensity;
      float ambientHalo = smoothstep(1.0, 0.0, r) * exp(-r2 * 1.4) * 0.30 * uGlowIntensity;
      intensity = (core + innerBloom + midBloom + ambientHalo) * (1.0 + 0.24 * uGlowIntensity);
      col = mix(vColor, vCoreColor, clamp(core * 0.95 + innerBloom * 0.28, 0.0, 0.99));
    } else {
      // Tier 3: Out-of-focus deep-blue/violet background bokeh disc & subtle volumetric nexus pool
      float softDisc = smoothstep(1.0, 0.06, r) * exp(-r2 * 1.95);
      intensity = softDisc * 0.48;
      col = vColor;
    }

    float finalAlpha = clamp(intensity * vAlpha, 0.0, 1.0);
    if (finalAlpha <= 0.002) discard;

    gl_FragColor = vec4(col * finalAlpha * 1.12, finalAlpha);
  }
`;

const PARTICLE_VERTEX_SHADER = /* glsl */ `
  attribute vec4 aColorWeights; // x: particle/primary, y: secondary, z: accent, w: highlight
  attribute float aAlpha;
  attribute float aParticleSize;
  attribute vec3 aBasePosition;
  attribute vec2 aUvParam;

  uniform vec3 uParticleColor;
  uniform vec3 uSecondaryColor;
  uniform vec3 uAccentColor;
  uniform vec3 uHighlightColor;
  uniform float uOpacity;
  uniform float uGlowIntensity;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying vec3 vHighlightColor;
  varying float vAlpha;
  varying float vHighlightWeight;

  void main() {
    vec3 finalPos = position;
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);

    vec3 tint =
      uParticleColor * aColorWeights.x +
      uSecondaryColor * aColorWeights.y +
      uAccentColor * aColorWeights.z +
      uHighlightColor * aColorWeights.w;

    vColor = tint * (1.14 + 0.20 * uGlowIntensity);
    vHighlightColor = uHighlightColor;
    vAlpha = clamp(aAlpha * uOpacity, 0.0, 1.0);
    vHighlightWeight = aColorWeights.w;

    // Varied small particle sizing (2.8px - 14.0px) — crisp luminous dust without large blurry circles
    float perspectiveScale = 255.0 / max(-mvPosition.z, 1.0);
    gl_PointSize = clamp(aParticleSize * perspectiveScale * uPixelRatio, 2.8, 14.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vHighlightColor;
  varying float vAlpha;
  varying float vHighlightWeight;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    if (r2 > 1.0 || vAlpha <= 0.001) discard;

    float core = exp(-r2 * 7.2) * 1.18;
    float microHalo = exp(-r2 * 2.3) * 0.36;
    float profile = clamp(core + microHalo, 0.0, 1.0);

    float alpha = clamp(profile * vAlpha, 0.0, 1.0);
    if (alpha <= 0.002) discard;

    vec3 finalCol = mix(vColor, vHighlightColor, clamp(core * (0.26 + 0.50 * vHighlightWeight), 0.0, 0.92));
    gl_FragColor = vec4(finalCol * alpha, alpha);
  }
`;

/**
 * Instantiates the shared set of GPU ShaderMaterials configured with the centralized theme.
 */
export function createNeuralWireMaterials(resolvedTheme, pixelRatio = 1) {
  const { colors, opacity, glowIntensity } = resolvedTheme;

  const createWireLayerMaterial = (layerOpacityScale) =>
    new THREE.ShaderMaterial({
      vertexShader: WIRE_VERTEX_SHADER,
      fragmentShader: WIRE_FRAGMENT_SHADER,
      uniforms: {
        uPrimaryColor: { value: colors.primaryWire.clone() },
        uSecondaryColor: { value: colors.secondaryWire.clone() },
        uAccentColor: { value: colors.accentWire.clone() },
        uHighlightColor: { value: colors.highlightNode.clone() },
        uOpacity: { value: opacity },
        uGlowIntensity: { value: glowIntensity },
        uLayerOpacityScale: { value: layerOpacityScale },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

  const heroRibbonMaterial = new THREE.ShaderMaterial({
    vertexShader: HERO_RIBBON_VERTEX_SHADER,
    fragmentShader: HERO_RIBBON_FRAGMENT_SHADER,
    uniforms: {
      uPrimaryColor: { value: colors.primaryWire.clone() },
      uSecondaryColor: { value: colors.secondaryWire.clone() },
      uAccentColor: { value: colors.accentWire.clone() },
      uHighlightColor: { value: colors.highlightNode.clone() },
      uOpacity: { value: opacity },
      uGlowIntensity: { value: glowIntensity },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const nodeMaterial = new THREE.ShaderMaterial({
    vertexShader: NODE_VERTEX_SHADER,
    fragmentShader: NODE_FRAGMENT_SHADER,
    uniforms: {
      uPrimaryColor: { value: colors.primaryWire.clone() },
      uSecondaryColor: { value: colors.secondaryWire.clone() },
      uAccentColor: { value: colors.accentWire.clone() },
      uNodeColor: { value: colors.node.clone() },
      uHighlightColor: { value: colors.highlightNode.clone() },
      uOpacity: { value: opacity },
      uGlowIntensity: { value: glowIntensity },
      uPixelRatio: { value: Math.min(pixelRatio, 2) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const particleMaterial = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    uniforms: {
      uParticleColor: { value: colors.particle.clone() },
      uSecondaryColor: { value: colors.secondaryWire.clone() },
      uAccentColor: { value: colors.accentWire.clone() },
      uHighlightColor: { value: colors.highlightNode.clone() },
      uOpacity: { value: opacity },
      uGlowIntensity: { value: glowIntensity },
      uPixelRatio: { value: Math.min(pixelRatio, 2) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // 4-Layer Visual Hierarchy:
  // - heroRibbonMaterial: Layer 1 (Main flowing primary optical-fiber filaments)
  // - layer0WireMaterial: Layer 2 (Fine secondary flowing filaments)
  // - layer1WireMaterial: Layer 3 (Delicate transverse & diagonal triangular mesh connections)
  // - layer2WireMaterial: Layer 4 (Subtle background depth strands)
  return {
    layer0WireMaterial: createWireLayerMaterial(0.98),
    layer1WireMaterial: createWireLayerMaterial(0.82),
    layer2WireMaterial: createWireLayerMaterial(0.54),
    heroRibbonMaterial,
    nodeMaterial,
    particleMaterial,
  };
}

/**
 * Updates existing material uniforms in-place when theme props or pixelRatio change.
 */
export function updateNeuralWireMaterials(materials, resolvedTheme, pixelRatio = 1) {
  if (!materials) return;
  const { colors, opacity, glowIntensity } = resolvedTheme;
  const clampedDpr = Math.min(pixelRatio, 2);

  const wireMats = [
    materials.layer0WireMaterial,
    materials.layer1WireMaterial,
    materials.layer2WireMaterial,
    materials.heroRibbonMaterial,
  ];

  wireMats.forEach((mat) => {
    if (!mat) return;
    mat.uniforms.uPrimaryColor.value.copy(colors.primaryWire);
    mat.uniforms.uSecondaryColor.value.copy(colors.secondaryWire);
    mat.uniforms.uAccentColor.value.copy(colors.accentWire);
    mat.uniforms.uHighlightColor.value.copy(colors.highlightNode);
    mat.uniforms.uOpacity.value = opacity;
    mat.uniforms.uGlowIntensity.value = glowIntensity;
  });

  if (materials.nodeMaterial) {
    const u = materials.nodeMaterial.uniforms;
    u.uPrimaryColor.value.copy(colors.primaryWire);
    u.uSecondaryColor.value.copy(colors.secondaryWire);
    u.uAccentColor.value.copy(colors.accentWire);
    u.uNodeColor.value.copy(colors.node);
    u.uHighlightColor.value.copy(colors.highlightNode);
    u.uOpacity.value = opacity;
    u.uGlowIntensity.value = glowIntensity;
    u.uPixelRatio.value = clampedDpr;
  }

  if (materials.particleMaterial) {
    const u = materials.particleMaterial.uniforms;
    u.uParticleColor.value.copy(colors.particle);
    u.uSecondaryColor.value.copy(colors.secondaryWire);
    u.uAccentColor.value.copy(colors.accentWire);
    u.uHighlightColor.value.copy(colors.highlightNode);
    u.uOpacity.value = opacity;
    u.uGlowIntensity.value = glowIntensity;
    u.uPixelRatio.value = clampedDpr;
  }
}

/* ============================================================================
 * FILE 3: src/components/neural-wire/neuralWireGeometry.js
 * Asymmetric multi-harmonic parametric 3D wire-mesh generator, non-parallel
 * braided filament hierarchy, irregular Delaunay-like local triangulation web,
 * distributed feathering central taper, and degree-aligned 3-tier node system.
 * ========================================================================== */

/**
 * Mulberry32 deterministic PRNG for 100% reproducible procedural generation.
 */
export function createSeededRandom(seed = 1337) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function computeResponsiveLayout(viewportWidth = 30, viewportHeight = 10) {
  const aspect = viewportWidth / Math.max(viewportHeight, 0.001);

  let tier = 'ultrawide';
  if (aspect < 0.9) tier = 'mobile';
  else if (aspect < 1.55) tier = 'tablet';
  else if (aspect < 2.3) tier = 'desktop';

  const halfWidth = viewportWidth * 0.5;
  // Calibrated central negative space: ~20-23% of total canvas width visually empty in the center.
  // Setting the inner hard stop at 16.5% of halfWidth allows the tapered inner tendrils (u = 0.88..0.99)
  // to visibly reach the ~20-22% central gap boundary without premature fade-out.
  const innerGapHalfWidth = halfWidth * (tier === 'mobile' ? 0.16 : 0.165);
  const outerExtentX = halfWidth * 1.035;
  const horizontalSpan = Math.max(outerExtentX - innerGapHalfWidth, 2.5);

  // Expanded vertical coverage so the outer sweeps span ~80-86% of canvas height and the middle
  // wave formations occupy ~55-68% of canvas height with generous dark margins above and below.
  const heightBasedScale =
    viewportHeight * (tier === 'mobile' ? 0.255 : tier === 'tablet' ? 0.285 : 0.315);
  const spanBasedScale = horizontalSpan * 0.285;
  const verticalScale = Math.min(heightBasedScale, spanBasedScale, 3.35);

  const cycleScale = tier === 'mobile' ? 0.88 : tier === 'tablet' ? 0.95 : 1.0;
  const densityScale = tier === 'mobile' ? 0.72 : tier === 'tablet' ? 0.88 : 1.0;

  return {
    tier,
    aspect,
    viewportWidth,
    viewportHeight,
    innerGapHalfWidth,
    outerExtentX,
    horizontalSpan,
    verticalScale,
    cycleScale,
    densityScale,
  };
}

/**
 * Smooth Gaussian pulse helper for localized crests, valleys, and focal nexuses.
 */
function gaussianPulse(u, center, width) {
  const d = (u - center) / width;
  return Math.exp(-d * d);
}

/**
 * Evaluates open, horizontally flowing 3D parametric ribbon sheets at (u, v).
 *
 * Refinements for Broad Vertical Coverage, Open Wave Flow & Continuous Mesh Volume:
 * 1. Expanded Vertical Breadth:
 *    - Sheet 0 and Sheet 1 have wider transverse separation between their upper and lower bounding
 *      guide curves (`guideTop` vs `guideBottom`), giving each ribbon sheet substantial vertical
 *      volume so the triangulated mesh cells fill the wave chambers richly.
 * 2. Extended Horizontal Reach into the ~20-23% Central Gap:
 *    - `innerTaper` and `innerVoidFade` preserve visible filament luminosity right up to `u = 0.92..0.99`
 *      before tapering cleanly to zero at the central negative space boundary.
 */
export function evaluateRibbonSurface(u, v, strandDescriptor, layerConfig, sideConfig, layout) {
  const { sideSign, isRight } = sideConfig;
  const { zBaseOffset, verticalSpreadScale, phaseShift, layerIndex } = layerConfig;
  const {
    streamId,         // 0: Main Flowing Sheet A, 1: Counter-Flowing Sheet B, 2: Accent & Outer Canopy Sheet C
    streamV,          // [0..1] monotonic transverse position across the sheet
    sLocal,           // [-1..1] centered transverse coordinate
    strandPhase,      // smoothly varying phase across neighboring strands
    freq2,            // gentle secondary undulation frequency
    ampMod,           // subtle amplitude variation
    zPhase,           // smooth 3D depth phase
    zBias,            // per-strand Z offset
    reachMod,         // [0.88..1.00] staggered horizontal reach into the inner taper zone
    fadeEndU,         // [0.84..0.995] gradual fade-out completion coordinate
    terminalYOffset,  // distributed vertical offset in the inner taper zone
    accentProfile,    // 0: standard, 1: lower violet-magenta sweep, 2: upper/inner violet wave, 3: outer canopy
  } = strandDescriptor;

  const uClamped = THREE.MathUtils.clamp(u, 0.0, 1.0);

  // 1. Monotonic Horizontal Placement (X)
  const effectiveSpan = layout.horizontalSpan * reachMod;
  const xMag = Math.max(
    layout.innerGapHalfWidth * 0.98,
    layout.outerExtentX - uClamped * effectiveSpan
  );
  const x = sideSign * xMag;

  // 2. Smooth Horizontal Taper Envelope (Broad at outer edge -> full undulating body -> gradual inner taper)
  const outerExpansion = 1.0 + 0.38 * Math.exp(-uClamped * 2.1);
  const innerTaper =
    1.0 - 0.82 * Math.pow(THREE.MathUtils.smoothstep(uClamped, 0.66, 0.995), 1.35);
  const envelope = outerExpansion * innerTaper;

  const uScaled = uClamped * layout.cycleScale;
  const pShift = phaseShift * 0.25;

  let ySheet = 0.0;

  if (!isRight) {
    // =========================================================================
    // LEFT FORMATION — Broad, Open, Horizontally Flowing Guide Curves (Asymmetric)
    // =========================================================================
    if (streamId === 0) {
      // Sheet 0 (Primary Descending-to-Valley-to-Inner-Crest Ribbon):
      // Enters broadly on the upper-left (+0.85..+0.25), sweeps through the left nexus (u ~ 0.34),
      // opens into a broad lower wave chamber (u ~ 0.53), and rises into a delicate inner crest (u ~ 0.74).
      const guideTop =
        0.74 * Math.cos(uScaled * Math.PI * 1.44 + 0.16 + pShift) * envelope +
        0.24 * Math.exp(-uClamped * 2.0) -
        0.14 * gaussianPulse(uClamped, 0.54, 0.16) +
        0.16 * gaussianPulse(uClamped, 0.74, 0.14);

      const guideBottom =
        0.18 * Math.cos(uScaled * Math.PI * 1.26 + 0.58 + pShift) * envelope -
        0.22 * gaussianPulse(uClamped, 0.34, 0.14) -
        0.58 * gaussianPulse(uClamped, 0.53, 0.17) +
        0.12 * gaussianPulse(uClamped, 0.75, 0.13);

      ySheet = THREE.MathUtils.lerp(guideBottom, guideTop, streamV);
    } else if (streamId === 1) {
      // Sheet 1 (Conjugate Lower-Entry to Broad Upper-Arch Ribbon):
      // Enters across the lower-left (-0.18..-0.72), passes through the u ~ 0.14 & u ~ 0.34 nexuses,
      // arches over the upper wave chamber (u ~ 0.51, reaching +0.62), and glides into the inner taper.
      const guideUpperArch =
        -0.12 * Math.exp(-uClamped * 2.2) +
        0.62 * gaussianPulse(uClamped, 0.51, 0.17) * innerTaper -
        0.06 * gaussianPulse(uClamped, 0.33, 0.12) +
        0.22 * Math.sin(uScaled * Math.PI * 1.58 - 0.48 + pShift) * innerTaper;

      const guideLowerFlow =
        -0.64 * Math.exp(-uClamped * 1.85) -
        0.24 * gaussianPulse(uClamped, 0.14, 0.13) +
        0.12 * gaussianPulse(uClamped, 0.48, 0.18) * innerTaper -
        0.18 * gaussianPulse(uClamped, 0.70, 0.14) * innerTaper +
        0.16 * Math.sin(uScaled * Math.PI * 1.36 - 0.82 + pShift) * innerTaper;

      ySheet = THREE.MathUtils.lerp(guideLowerFlow, guideUpperArch, streamV);
    } else {
      // Sheet 2 (Selective Violet-Magenta Sweeps & Broad Outer Canopy)
      if (accentProfile === 1) {
        // Lower-left sweeping violet-magenta filament
        ySheet =
          (-0.42 * Math.exp(-uClamped * 2.0) -
            0.68 * gaussianPulse(uClamped, 0.37, 0.18) -
            0.24 * gaussianPulse(uClamped, 0.58, 0.15) +
            0.14 * gaussianPulse(uClamped, 0.76, 0.13)) *
          innerTaper;
      } else if (accentProfile === 2) {
        // Inner-left violet-magenta & cyan wave filament
        ySheet =
          (0.28 * Math.exp(-uClamped * 2.2) -
            0.14 * gaussianPulse(uClamped, 0.34, 0.13) +
            0.36 * gaussianPulse(uClamped, 0.52, 0.15) -
            0.24 * gaussianPulse(uClamped, 0.68, 0.13) +
            0.12 * gaussianPulse(uClamped, 0.82, 0.11)) *
          innerTaper;
      } else {
        // High & low outer canopy boundary filaments
        const canopySign = sLocal >= 0 ? 1.0 : -1.0;
        ySheet =
          canopySign *
            (1.06 * Math.exp(-uClamped * 1.62) +
              0.38 * gaussianPulse(uClamped, 0.42, 0.22) -
              0.12 * gaussianPulse(uClamped, 0.26, 0.14)) *
            innerTaper +
          0.11 * Math.sin(uScaled * Math.PI * 1.52 + strandPhase) * innerTaper;
      }
    }
  } else {
    // =========================================================================
    // RIGHT FORMATION — Broad, Open, Horizontally Flowing Guide Curves (Asymmetric)
    // =========================================================================
    if (streamId === 0) {
      // Sheet 0 (Upper-Right Entry -> Main Right Nexus -> Lower-Middle Trough):
      // Enters high on the right edge (+0.88..+0.22), passes through the upper-right bright node (u ~ 0.18)
      // and main right nexus (u ~ 0.34), sweeps into the lower-middle trough (u ~ 0.48), and rises inward.
      const guideTop =
        0.78 * Math.exp(-uClamped * 1.60) +
        0.30 * gaussianPulse(uClamped, 0.18, 0.14) -
        0.24 * gaussianPulse(uClamped, 0.48, 0.16) * innerTaper +
        0.18 * gaussianPulse(uClamped, 0.72, 0.14) * innerTaper +
        0.24 * Math.cos(uScaled * Math.PI * 1.40 - 0.22 + pShift) * innerTaper;

      const guideBottom =
        0.16 * Math.exp(-uClamped * 1.95) -
        0.60 * gaussianPulse(uClamped, 0.48, 0.17) * innerTaper +
        0.16 * gaussianPulse(uClamped, 0.74, 0.13) * innerTaper +
        0.24 * Math.cos(uScaled * Math.PI * 1.50 + 0.26 + pShift) * innerTaper;

      ySheet = THREE.MathUtils.lerp(guideBottom, guideTop, streamV);
    } else if (streamId === 1) {
      // Sheet 1 (Lower-Right Entry -> Upper-Middle Violet-Cyan Arch -> Inner Taper):
      // Enters low on the right edge (-0.20..-0.85), rises across u ~ 0.34 into the prominent
      // upper arch (u ~ 0.53, reaching +0.62), and slopes smoothly toward the inner taper.
      const guideUpperArch =
        -0.16 * Math.exp(-uClamped * 2.0) +
        0.60 * gaussianPulse(uClamped, 0.53, 0.16) * innerTaper +
        0.18 * gaussianPulse(uClamped, 0.72, 0.14) * innerTaper +
        0.18 * Math.sin(uScaled * Math.PI * 1.54 - 0.32 + pShift) * innerTaper;

      const guideLowerFlow =
        -0.82 * Math.exp(-uClamped * 1.68) -
        0.26 * gaussianPulse(uClamped, 0.15, 0.13) +
        0.16 * gaussianPulse(uClamped, 0.52, 0.17) * innerTaper -
        0.18 * gaussianPulse(uClamped, 0.68, 0.13) * innerTaper +
        0.16 * Math.sin(uScaled * Math.PI * 1.32 - 0.70 + pShift) * innerTaper;

      ySheet = THREE.MathUtils.lerp(guideLowerFlow, guideUpperArch, streamV);
    } else {
      // Sheet 2 (Selective Violet-Magenta Sweeps & Broad Outer Canopy)
      if (accentProfile === 1) {
        // Lower-right sweeping violet-magenta filament
        ySheet =
          (-0.88 * Math.exp(-uClamped * 1.70) -
            0.40 * gaussianPulse(uClamped, 0.22, 0.16) -
            0.24 * gaussianPulse(uClamped, 0.48, 0.15) +
            0.18 * gaussianPulse(uClamped, 0.68, 0.13)) *
          innerTaper;
      } else if (accentProfile === 2) {
        // Upper-middle right violet-magenta arch filament (cresting at u ~ 0.53)
        ySheet =
          (0.30 * Math.exp(-uClamped * 2.2) -
            0.12 * gaussianPulse(uClamped, 0.31, 0.12) +
            0.60 * gaussianPulse(uClamped, 0.53, 0.15) -
            0.18 * gaussianPulse(uClamped, 0.73, 0.12)) *
          innerTaper;
      } else {
        // High & low outer canopy boundary filaments
        const canopySign = sLocal >= 0 ? 1.0 : -1.0;
        ySheet =
          canopySign *
            (1.08 * Math.exp(-uClamped * 1.58) +
              0.38 * gaussianPulse(uClamped, 0.24, 0.20) +
              0.26 * gaussianPulse(uClamped, 0.52, 0.18)) *
            innerTaper +
          0.11 * Math.cos(uScaled * Math.PI * 1.48 + strandPhase) * innerTaper;
      }
    }
  }

  // 3. Organic, Phase-Distributed Secondary Undulation (Independent phase per strand without tangling)
  const gentleRipple =
    Math.sin(uScaled * Math.PI * (1.68 * freq2) + strandPhase) *
    (0.085 + 0.065 * (1.0 - uClamped * 0.55)) *
    innerTaper *
    ampMod;

  // 4. Gradual Inner Taper Distribution (Prevents strands from converging to a single point)
  const innerDistribution =
    THREE.MathUtils.smoothstep(uClamped, 0.58, 0.98) *
    terminalYOffset *
    (1.0 - 0.25 * THREE.MathUtils.smoothstep(uClamped, 0.90, 1.0));

  const yNorm = ySheet + gentleRipple + innerDistribution;
  const y = yNorm * layout.verticalScale * verticalSpreadScale;

  // 5. Perceptible 3D Spatial Depth (Z): Multi-layer depth separation + front-to-back sheet weaving
  const sheetDepthSign = streamId === 0 ? 1.0 : streamId === 1 ? -1.0 : 0.55 * sLocal;
  const zWeave =
    (sheetDepthSign * 0.88 * Math.sin(uClamped * Math.PI * 1.65 + zPhase) +
      0.46 * Math.cos(uClamped * Math.PI * 2.25 + strandPhase * 0.7) +
      sLocal * 0.52 +
      zBias) *
    innerTaper;
  const z = zBaseOffset + zWeave - layerIndex * 0.28 * uClamped;

  // 6. Side-Specific Focal Nexus & Crest Proximity Metrics for Controlled Luminance Hierarchy
  const pinchProximity = isRight
    ? Math.max(
        0.96 * gaussianPulse(uClamped, 0.180, 0.090),
        0.96 * gaussianPulse(uClamped, 0.340, 0.090),
        1.00 * gaussianPulse(uClamped, 0.480, 0.092),
        0.90 * gaussianPulse(uClamped, 0.150, 0.082),
        0.80 * gaussianPulse(uClamped, 0.680, 0.088)
      )
    : Math.max(
        0.96 * gaussianPulse(uClamped, 0.140, 0.088),
        1.00 * gaussianPulse(uClamped, 0.340, 0.092),
        0.94 * gaussianPulse(uClamped, 0.530, 0.092),
        0.84 * gaussianPulse(uClamped, 0.675, 0.088)
      );

  const crestProximity = isRight
    ? Math.max(
        gaussianPulse(uClamped, 0.530, 0.130),
        gaussianPulse(uClamped, 0.480, 0.120),
        gaussianPulse(uClamped, 0.180, 0.115)
      )
    : Math.max(
        gaussianPulse(uClamped, 0.520, 0.130),
        gaussianPulse(uClamped, 0.370, 0.120),
        gaussianPulse(uClamped, 0.220, 0.115)
      );

  // 7. Smooth Outer Entry & Full-Reach Inner Taper Fade
  const outerEdgeFade = THREE.MathUtils.smoothstep(uClamped, 0.0, 0.020);
  const fadeStartU = Math.max(0.74, fadeEndU - 0.20);
  const innerVoidFade = 1.0 - THREE.MathUtils.smoothstep(uClamped, fadeStartU, fadeEndU);
  const edgeFade = outerEdgeFade * Math.pow(innerVoidFade, 1.08);

  return {
    x,
    y,
    z,
    u: uClamped,
    v,
    streamId,
    pinchProximity,
    crestProximity,
    edgeFade,
  };
}

/**
 * Generates longitudinal strand descriptors per side and depth layer.
 *
 * Organization per side:
 * - Layer 0 (Foreground Dominant Mesh): 28 strands (11 in Sheet 0, 11 in Sheet 1, 6 in Sheet 2)
 *   including 7 prominent Primary Optical-Fiber Hero Filaments (3 in Sheet 0, 2 in Sheet 1, 2 Violet in Sheet 2)
 * - Layer 1 (Mid-Depth Overlapping Mesh): 20 strands including 2 supporting Primary Hero Filaments
 * - Layer 2 (Deep Background Mesh): 14 strands creating perceptible 3D volumetric depth
 */
function createLayerStrandDescriptors(layerIndex, isRight, densityScale, rng) {
  const descriptors = [];

  const sheet0Count = Math.max(
    5,
    Math.round((layerIndex === 0 ? 11 : layerIndex === 1 ? 8 : 5) * densityScale)
  );
  const sheet1Count = Math.max(
    5,
    Math.round((layerIndex === 0 ? 11 : layerIndex === 1 ? 8 : 5) * densityScale)
  );
  const sheet2Count = layerIndex === 0 ? 6 : layerIndex === 1 ? 4 : 4;

  const totalStrands = sheet0Count + sheet1Count + sheet2Count;
  let globalJ = 0;

  const pushSheetStrands = (streamId, count) => {
    for (let k = 0; k < count; k++) {
      const streamV = count > 1 ? k / (count - 1) : 0.5;
      const sLocal = streamV * 2.0 - 1.0;
      const globalV = totalStrands > 1 ? globalJ / (totalStrands - 1) : 0.5;

      let role = 'secondary';
      let isPrimaryHero = false;
      let accentProfile = 0;
      let heroWeight = 0.0;
      let isBeadedCanopy = false;

      if (streamId === 0) {
        // 3 primary cyan/ice-blue hero filaments in Sheet 0 (Layer 0) + 1 in Layer 1
        const heroIdxA = Math.round((count - 1) * (isRight ? 0.82 : 0.80));
        const heroIdxB = Math.round((count - 1) * (isRight ? 0.48 : 0.52));
        const heroIdxC = Math.round((count - 1) * (isRight ? 0.16 : 0.18));
        if (layerIndex === 0 && (k === heroIdxA || k === heroIdxB || k === heroIdxC)) {
          role = 'primary';
          isPrimaryHero = true;
          heroWeight = k === heroIdxA ? 1.0 : k === heroIdxB ? 0.90 : 0.84;
        } else if (layerIndex === 1 && k === heroIdxA) {
          role = 'primary';
          isPrimaryHero = true;
          heroWeight = 0.72;
        }
      } else if (streamId === 1) {
        // 2 primary cyan/ice-blue hero filaments in Sheet 1 (Layer 0) + 1 in Layer 1
        const heroIdxD = Math.round((count - 1) * (isRight ? 0.80 : 0.82));
        const heroIdxE = Math.round((count - 1) * (isRight ? 0.24 : 0.22));
        if (layerIndex === 0 && (k === heroIdxD || k === heroIdxE)) {
          role = 'primary';
          isPrimaryHero = true;
          heroWeight = k === heroIdxD ? 0.96 : 0.86;
        } else if (layerIndex === 1 && k === heroIdxD) {
          role = 'primary';
          isPrimaryHero = true;
          heroWeight = 0.70;
        }
      } else {
        // Sheet 2: 2 selective violet-magenta hero filaments + 4 delicate outer canopy strands
        if (k === 0) {
          role = 'accent';
          accentProfile = 1; // Lower sweeping violet-magenta hero filament
          isPrimaryHero = layerIndex === 0;
          heroWeight = 0.94;
        } else if (k === 1) {
          role = 'accent';
          accentProfile = 2; // Upper/inner violet-magenta arch hero filament
          isPrimaryHero = layerIndex === 0;
          heroWeight = 0.90;
        } else {
          role = 'canopy';
          accentProfile = 3; // Outer canopy boundary filament
          isBeadedCanopy = k === 2 || k === count - 1;
        }
      }

      const effectiveSLocal =
        streamId === 2 && k >= 2
          ? count > 3
            ? ((k - 2) / (count - 3)) * 2.0 - 1.0
            : k === 2
            ? 1.0
            : -1.0
          : sLocal;

      const baseSheetPhase =
        streamId === 0
          ? isRight ? 0.24 : -0.22
          : streamId === 1
          ? isRight ? -0.54 : 0.48
          : isRight ? 0.62 : -0.52;

      const strandPhase = baseSheetPhase + effectiveSLocal * 0.62 + (rng() - 0.5) * 0.14;
      const braidPhase =
        (isRight ? 0.95 : -0.88) * (streamId + 1) + effectiveSLocal * 0.68;
      const harmonicPhase = effectiveSLocal * 0.92 + (isRight ? 1.4 : 0.6);

      const freq1 = (isRight ? 1.00 : 0.98) + 0.06 * (streamV - 0.5);
      const freq2 = 0.92 + 0.18 * streamV + (rng() - 0.5) * 0.06;
      const freq3 = 0.90 + 0.18 * streamV;
      const ampMod = 0.90 + 0.24 * Math.sin(streamV * Math.PI);
      const zPhase = streamId * 1.08 + streamV * 0.98 + (rng() - 0.5) * 0.20;
      const zBias = (streamV - 0.5) * 0.42 + (rng() - 0.5) * 0.16;

      // Full reach toward the ~20-23% central negative space with gradual staggered tapering
      const reachMod = isPrimaryHero
        ? 0.965 + 0.035 * rng()
        : role === 'canopy'
        ? 0.82 + 0.12 * rng()
        : 0.88 + 0.10 * streamV + 0.02 * rng();

      const fadeEndU = isPrimaryHero
        ? 0.965 + 0.032 * rng()
        : role === 'canopy'
        ? 0.82 + 0.12 * rng()
        : 0.88 + 0.10 * streamV + 0.02 * rng();

      const terminalYOffset =
        (streamId === 0 ? 0.05 : streamId === 1 ? -0.05 : 0.0) +
        effectiveSLocal * 0.13 +
        (rng() - 0.5) * 0.05;

      descriptors.push({
        strandIndex: globalJ,
        streamId,
        streamIndex: k,
        streamCount: count,
        streamV,
        sLocal: effectiveSLocal,
        envelopeMix: effectiveSLocal,
        v: globalV,
        role,
        accentProfile,
        isPrimaryHero,
        isBeadedCanopy,
        heroWeight,
        strandPhase,
        braidPhase,
        harmonicPhase,
        freq1,
        freq2,
        freq3,
        ampMod,
        zPhase,
        zBias,
        reachMod,
        fadeEndU,
        terminalYOffset,
      });

      globalJ++;
    }
  };

  pushSheetStrands(0, sheet0Count);
  pushSheetStrands(1, sheet1Count);
  pushSheetStrands(2, sheet2Count);

  return descriptors;
}

/**
 * Computes vertex color weights and opacity to enforce a luminous 3-level wire hierarchy
 * with rich cyan / electric-blue / violet-magenta / ice-white color separation.
 */
function computeVertexAppearance(
  pointEval,
  strandDescriptor,
  layerIndex,
  wireType = 'filament',
  localDensityBoost = 0.0
) {
  const { u, pinchProximity, crestProximity, edgeFade } = pointEval;
  const { role, accentProfile, isPrimaryHero, heroWeight } = strandDescriptor;

  let wPrimary = 0.0;
  let wSecondary = 0.0;
  let wAccent = 0.0;
  let wHighlight = 0.0;
  let alpha = edgeFade;

  if (wireType === 'connection') {
    // Continuous, clearly visible irregular triangular & polygonal mesh cells
    const violetZone =
      role === 'accent'
        ? 0.78
        : 0.42 * gaussianPulse(u, 0.64, 0.18) + 0.36 * gaussianPulse(u, 0.28, 0.16);

    if (layerIndex === 0) {
      wPrimary = 0.36 + 0.28 * pinchProximity + 0.16 * localDensityBoost - violetZone * 0.14;
      wSecondary = 0.88 - 0.12 * pinchProximity - violetZone * 0.20;
      wAccent = violetZone;
      wHighlight = 0.20 * Math.pow(pinchProximity, 1.5);
      alpha *= 0.28 + 0.26 * pinchProximity + 0.12 * crestProximity + 0.10 * localDensityBoost;
    } else if (layerIndex === 1) {
      wPrimary = 0.26 + 0.20 * pinchProximity;
      wSecondary = 0.88;
      wAccent = violetZone * 0.92;
      wHighlight = 0.08 * pinchProximity;
      alpha *= 0.22 + 0.18 * pinchProximity;
    } else {
      wPrimary = 0.18;
      wSecondary = 0.90;
      wAccent = 0.36;
      wHighlight = 0.0;
      alpha *= 0.15 + 0.10 * pinchProximity;
    }
  } else {
    // Longitudinal Filaments
    if (role === 'accent') {
      const violetWindow =
        accentProfile === 1
          ? gaussianPulse(u, 0.34, 0.28) + 0.96 * gaussianPulse(u, 0.66, 0.22)
          : gaussianPulse(u, 0.54, 0.24) + 0.88 * gaussianPulse(u, 0.22, 0.18);
      const vMix = THREE.MathUtils.clamp(violetWindow, 0.72, 1.0);
      wAccent = 1.08 * vMix;
      wPrimary = 0.18 * (1.0 - vMix * 0.65);
      wSecondary = 0.14 * (1.0 - vMix * 0.55);
      wHighlight = 0.34 * Math.pow(Math.max(pinchProximity, crestProximity * 0.85), 1.4);
      alpha *= isPrimaryHero ? 0.90 : 0.56;
    } else if (isPrimaryHero || role === 'primary') {
      const innerVioletTouch =
        0.62 * gaussianPulse(u, 0.68, 0.13) + 0.32 * gaussianPulse(u, 0.36, 0.14);
      wPrimary = 0.98 - innerVioletTouch * 0.52;
      wSecondary = 0.24 * (1.0 - innerVioletTouch * 0.5);
      wAccent = innerVioletTouch * 1.05;
      wHighlight = THREE.MathUtils.clamp(
        0.62 * Math.pow(pinchProximity, 1.3) + 0.36 * Math.pow(crestProximity, 1.4),
        0.08,
        0.92
      );
      alpha *= isPrimaryHero ? 0.88 + 0.10 * heroWeight : 0.64;
    } else if (role === 'canopy') {
      wPrimary = 0.36;
      wSecondary = 0.82;
      wAccent = 0.34;
      wHighlight = 0.14 * pinchProximity;
      alpha *= 0.38;
    } else {
      // Secondary flowing longitudinal strands: clearly distinguishable supporting curves
      const strandMod = 0.42 + 0.18 * Math.sin(strandDescriptor.strandPhase * 1.9);
      const isVioletSecondary = strandDescriptor.streamIndex % 3 === 1;
      wPrimary = isVioletSecondary
        ? 0.26
        : layerIndex === 0
        ? 0.52 + 0.22 * pinchProximity
        : 0.36;
      wSecondary = isVioletSecondary ? 0.46 : layerIndex === 0 ? 0.82 : 0.88;
      wAccent = isVioletSecondary
        ? 0.82 * (0.48 + 0.52 * Math.sin(u * Math.PI))
        : layerIndex === 1
        ? 0.38 * Math.sin(u * Math.PI)
        : 0.26 * gaussianPulse(u, 0.64, 0.20);
      wHighlight = layerIndex === 0 ? 0.18 * Math.pow(pinchProximity, 1.5) : 0.07 * pinchProximity;
      alpha *=
        layerIndex === 0
          ? strandMod + 0.18 * pinchProximity
          : layerIndex === 1
          ? 0.36 + 0.14 * pinchProximity
          : 0.24;
    }
  }

  return {
    weights: [wPrimary, wSecondary, wAccent, wHighlight],
    alpha: THREE.MathUtils.clamp(alpha, 0.0, 1.0),
  };
}

/**
 * Generates the static Phase 1 procedural 3D neural wireframe geometry:
 * - Asymmetric Left & Right multi-layer parametric formations
 * - Smooth spline-interpolated primary & secondary filaments passing through exact mesh vertices
 * - Y-Rank + Spatial Proximity Triangulation Web that fills wave chamber interiors uniformly
 * - Degree-tracked 3-tier glowing connection nodes + volumetric nexus light pools & background bokeh
 */
export function generateNeuralWireGeometry(layout) {
  // 3 Spatial Generation Passes that populate our 4-Layer Visual Hierarchy:
  // - heroRibbonGeometry: Layer 1 (5 prominent primary optical-fiber filaments per side)
  // - layerLineBuffers[0]: Layer 2 (Fine secondary flowing filaments in foreground & mid-depth)
  // - layerLineBuffers[1]: Layer 3 (Delicate transverse & diagonal triangular mesh connections)
  // - layerLineBuffers[2]: Layer 4 (Subtle background depth strands & deep mesh cells)
  const layerConfigs = [
    {
      layerIndex: 0,
      numU: Math.round(58 * layout.densityScale),
      subStepsPerSpan: 3,
      zBaseOffset: 0.25,
      verticalSpreadScale: 1.0,
      phaseShift: 0.0,
    },
    {
      layerIndex: 1,
      numU: Math.round(44 * layout.densityScale),
      subStepsPerSpan: 2,
      zBaseOffset: -1.45,
      verticalSpreadScale: 1.15,
      phaseShift: 0.78,
    },
    {
      layerIndex: 2,
      numU: Math.round(34 * layout.densityScale),
      subStepsPerSpan: 2,
      zBaseOffset: -3.10,
      verticalSpreadScale: 1.30,
      phaseShift: -1.05,
    },
  ];

  // Dedicated buffers for the 4-layer structural separation:
  // [0]: Secondary flowing longitudinal strands
  // [1]: Fine transverse & diagonal triangular mesh connections
  // [2]: Subtle background depth strands & connections
  const layerLineBuffers = [0, 1, 2].map(() => ({
    positions: [],
    basePositions: [],
    colorWeights: [],
    alphas: [],
    uvParams: [],
    metas: [],
  }));

  const heroRibbonData = {
    positions: [],
    basePositions: [],
    colorWeights: [],
    alphas: [],
    crossCoords: [],
    uvParams: [],
    metas: [],
    indices: [],
    vertexCount: 0,
  };

  const nodeData = {
    positions: [],
    basePositions: [],
    colorWeights: [],
    alphas: [],
    sizes: [],
    tiers: [],
    uvParams: [],
    metas: [],
  };

  const canonicalVertices = [];

  const pushLineSegment = (buf, vA, vB, appA, appB) => {
    buf.positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
    buf.basePositions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
    buf.colorWeights.push(...appA.weights, ...appB.weights);
    buf.alphas.push(appA.alpha, appB.alpha);
    buf.uvParams.push(vA.u, vA.v, vB.u, vB.v);
    buf.metas.push(
      vA.sideSign,
      vA.layerIndex,
      vA.strandIndex,
      vA.pinchProximity,
      vB.sideSign,
      vB.layerIndex,
      vB.strandIndex,
      vB.pinchProximity
    );
  };

  const pushNode = (v, weights, alpha, size, tier) => {
    nodeData.positions.push(v.x, v.y, v.z);
    nodeData.basePositions.push(v.x, v.y, v.z);
    nodeData.colorWeights.push(...weights);
    nodeData.alphas.push(alpha);
    nodeData.sizes.push(size);
    nodeData.tiers.push(tier);
    nodeData.uvParams.push(v.u, v.v);
    nodeData.metas.push(v.sideSign, v.layerIndex, v.strandIndex, v.pinchProximity);
  };

  const sides = [
    { side: 'left', sideSign: -1, isRight: false, seed: 20260501 },
    { side: 'right', sideSign: 1, isRight: true, seed: 20260917 },
  ];

  sides.forEach((sideConfig) => {
    const rng = createSeededRandom(sideConfig.seed);

    layerConfigs.forEach((layerConfig) => {
      const { layerIndex, numU, subStepsPerSpan } = layerConfig;
      // Route longitudinal filaments to Layer 2 buffer ([0]) for foreground/mid layers, or Layer 4 buffer ([2]) for deep background
      const filamentLineBuf = layerIndex === 2 ? layerLineBuffers[2] : layerLineBuffers[0];
      // Route transverse/diagonal mesh connections to Layer 3 buffer ([1]) for foreground/mid layers, or Layer 4 buffer ([2]) for deep background
      const connectionLineBuf = layerIndex === 2 ? layerLineBuffers[2] : layerLineBuffers[1];

      const strandDescriptors = createLayerStrandDescriptors(
        layerIndex,
        sideConfig.isRight,
        layout.densityScale,
        rng
      );
      const numV = strandDescriptors.length;

      // 1. Construct Canonical Mesh Vertex Grid with Controlled U-Staggering
      // Staggering U smoothly across neighboring strands creates organic, non-rectangular
      // triangular cells while preserving monotonic horizontal progression.
      const grid = Array.from({ length: numU }, () => new Array(numV));

      for (let i = 0; i < numU; i++) {
        const uLinear = i / (numU - 1);
        const uDensityWarp =
          uLinear -
          0.018 * Math.sin(uLinear * Math.PI * 2.5 + (sideConfig.isRight ? 0.35 : -0.25));

        for (let j = 0; j < numV; j++) {
          const desc = strandDescriptors[j];
          // Alternating half-step stagger between adjacent strands j and j+1 so triangles
          // form natural isosceles/scalene cells along the curved sheet
          const altStagger = ((j % 2) - 0.5) * 0.42 + (rng() - 0.5) * 0.28;
          const uEffective =
            i > 0 && i < numU - 1
              ? THREE.MathUtils.clamp(
                  uDensityWarp + altStagger / (numU - 1),
                  0.002,
                  0.998
                )
              : THREE.MathUtils.clamp(uLinear, 0.0, 1.0);

          const evaluated = evaluateRibbonSurface(
            uEffective,
            desc.v,
            desc,
            layerConfig,
            sideConfig,
            layout
          );

          const vertexRecord = {
            ...evaluated,
            uIndex: i,
            vIndex: j,
            strandIndex: j,
            layerIndex,
            sideSign: sideConfig.sideSign,
            isRight: sideConfig.isRight,
            descriptor: desc,
            degree: 0,
            heroJunction: desc.isPrimaryHero ? 1 : 0,
          };

          grid[i][j] = vertexRecord;
          canonicalVertices.push(vertexRecord);
        }
      }

      // 2. Emit Smooth Longitudinal Filaments Passing EXACTLY Through Every Grid Vertex
      for (let j = 0; j < numV; j++) {
        const desc = strandDescriptors[j];
        const controlPoints = [];
        for (let i = 0; i < numU; i++) {
          const gv = grid[i][j];
          controlPoints.push(new THREE.Vector3(gv.x, gv.y, gv.z));
        }

        const curve = new THREE.CatmullRomCurve3(controlPoints, false, 'centripetal', 0.5);
        const totalSamples = (numU - 1) * subStepsPerSpan;
        const sampledVertices = [];

        let prevSample = null;
        let prevApp = null;

        for (let s = 0; s <= totalSamples; s++) {
          const exactGridIdx = s % subStepsPerSpan === 0 ? s / subStepsPerSpan : -1;
          let sampleVertex;

          if (exactGridIdx >= 0 && exactGridIdx < numU) {
            sampleVertex = grid[exactGridIdx][j];
          } else {
            const tCurve = s / totalSamples;
            const pt = curve.getPoint(tCurve);
            const iFloor = Math.floor(tCurve * (numU - 1));
            const iCeil = Math.min(numU - 1, iFloor + 1);
            const frac = tCurve * (numU - 1) - iFloor;
            const v0 = grid[iFloor][j];
            const v1 = grid[iCeil][j];
            const uInterp = THREE.MathUtils.lerp(v0.u, v1.u, frac);

            const surfMeta = evaluateRibbonSurface(
              uInterp,
              desc.v,
              desc,
              layerConfig,
              sideConfig,
              layout
            );

            sampleVertex = {
              x: pt.x,
              y: pt.y,
              z: pt.z,
              u: uInterp,
              v: desc.v,
              pinchProximity: surfMeta.pinchProximity,
              crestProximity: surfMeta.crestProximity,
              edgeFade: surfMeta.edgeFade,
              sideSign: sideConfig.sideSign,
              layerIndex,
              strandIndex: j,
            };
          }

          sampledVertices.push(sampleVertex);
          const currApp = computeVertexAppearance(sampleVertex, desc, layerIndex, 'filament');

          if (prevSample) {
            pushLineSegment(filamentLineBuf, prevSample, sampleVertex, prevApp, currApp);
          }

          prevSample = sampleVertex;
          prevApp = currApp;
        }

        // Layer 1: Emit Thin, Luminous Optical-Fiber Primary Hero Filaments
        // Calibrated width (0.068 - 0.082 world units) ensures crisp 1.5-2px cores without thick bands
        if (desc.isPrimaryHero) {
          const baseRibbonHalfWidth =
            desc.role === 'accent'
              ? 0.068
              : 0.078 * (0.84 + 0.18 * desc.heroWeight);
          const startVertexOffset = heroRibbonData.vertexCount;

          for (let s = 0; s <= totalSamples; s++) {
            const sv = sampledVertices[s];
            const prevSv = sampledVertices[Math.max(0, s - 1)];
            const nextSv = sampledVertices[Math.min(totalSamples, s + 1)];

            const tx = nextSv.x - prevSv.x;
            const ty = nextSv.y - prevSv.y;
            const tLen = Math.hypot(tx, ty) || 1.0;
            const nx = -ty / tLen;
            const ny = tx / tLen;

            const emphasis =
              0.84 +
              0.44 * sv.pinchProximity +
              0.28 * sv.crestProximity +
              0.08 * Math.sin(sv.u * Math.PI * 2.5 + desc.strandPhase);
            const widthMod =
              baseRibbonHalfWidth * emphasis * Math.pow(Math.max(sv.edgeFade, 0.001), 0.40);

            const app = computeVertexAppearance(sv, desc, layerIndex, 'filament');
            const ribbonAlpha =
              app.alpha *
              THREE.MathUtils.clamp(0.82 + 0.18 * sv.pinchProximity, 0.74, 0.98);

            const lx = sv.x - nx * widthMod;
            const ly = sv.y - ny * widthMod;
            const rx = sv.x + nx * widthMod;
            const ry = sv.y + ny * widthMod;

            heroRibbonData.positions.push(lx, ly, sv.z, rx, ry, sv.z);
            heroRibbonData.basePositions.push(lx, ly, sv.z, rx, ry, sv.z);
            heroRibbonData.colorWeights.push(...app.weights, ...app.weights);
            heroRibbonData.alphas.push(ribbonAlpha, ribbonAlpha);
            heroRibbonData.crossCoords.push(-1.0, 1.0);
            heroRibbonData.uvParams.push(sv.u, sv.v, sv.u, sv.v);
            heroRibbonData.metas.push(
              sv.sideSign,
              sv.layerIndex,
              sv.strandIndex,
              sv.pinchProximity,
              sv.sideSign,
              sv.layerIndex,
              sv.strandIndex,
              sv.pinchProximity
            );
            heroRibbonData.vertexCount += 2;
          }

          for (let s = 0; s < totalSamples; s++) {
            const idx = startVertexOffset + s * 2;
            heroRibbonData.indices.push(idx, idx + 1, idx + 2, idx + 1, idx + 3, idx + 2);
          }
        }
      }

      // 3. Layer 3: Continuous Sheet-Coherent Triangulation & Inter-Sheet 3D Volume Web
      // Calibrated maxEdgeDist & maxSlope (1.42) so adjacent strands remain continuously
      // triangulated across the broad open wave chambers without leaving isolated empty gaps.
      const maxEdgeDist =
        (layerIndex === 0 ? 1.15 : layerIndex === 1 ? 1.28 : 1.42) * layout.verticalScale;
      const minEdgeDist = 0.028 * layout.verticalScale;
      const maxSlope = 1.42;

      const connectedPairs = new Set();
      const makeEdgeKey = (vA, vB) => {
        const idA = vA.uIndex * 1000 + vA.vIndex;
        const idB = vB.uIndex * 1000 + vB.vIndex;
        return idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`;
      };

      const connectVertices = (vA, vB, densityBoost = 0.0) => {
        if (!vA || !vB || vA === vB) return false;
        const key = makeEdgeKey(vA, vB);
        if (connectedPairs.has(key)) return false;

        const dx = Math.abs(vA.x - vB.x);
        const dy = Math.abs(vA.y - vB.y);
        const dz = Math.abs(vA.z - vB.z);
        const dist = Math.hypot(dx, dy, dz * 0.45);

        if (dx < 0.045 || dy / dx > maxSlope || dist > maxEdgeDist || dist < minEdgeDist) {
          return false;
        }

        connectedPairs.add(key);
        vA.degree += 1;
        vB.degree += 1;
        if (vA.descriptor.isPrimaryHero || vB.descriptor.isPrimaryHero) {
          vA.heroJunction += 1;
          vB.heroJunction += 1;
        }

        const appA = computeVertexAppearance(
          vA,
          vA.descriptor,
          layerIndex,
          'connection',
          densityBoost
        );
        const appB = computeVertexAppearance(
          vB,
          vB.descriptor,
          layerIndex,
          'connection',
          densityBoost
        );

        pushLineSegment(connectionLineBuf, vA, vB, appA, appB);
        return true;
      };

      const evaluateCellDensity = (u, v) => {
        const w1 = Math.sin(u * Math.PI * 3.6 + v * 4.2 + (sideConfig.isRight ? 0.9 : -0.6));
        const w2 = Math.cos(u * Math.PI * 5.2 - v * 3.0 + (sideConfig.isRight ? -0.8 : 1.1));
        return THREE.MathUtils.clamp(0.76 + 0.16 * w1 + 0.12 * w2, 0.48, 1.0);
      };

      // Pass 3A: Continuous Intra-Sheet Woven Triangulation (Connects j -> j+1, j+2 across all U)
      for (let i = 0; i < numU - 1; i++) {
        for (let j = 0; j < numV - 1; j++) {
          const v00 = grid[i][j];
          const v01 = grid[i][j + 1];
          if (v00.edgeFade <= 0.03) continue;

          if (v00.descriptor.streamId !== v01.descriptor.streamId) continue;

          const cellDensity = evaluateCellDensity(v00.u, v00.v);
          const taperDensity =
            1.0 - 0.46 * Math.pow(THREE.MathUtils.smoothstep(v00.u, 0.72, 0.99), 1.3);
          const connectProb =
            (layerIndex === 0 ? 0.94 : layerIndex === 1 ? 0.78 : 0.58) *
            (0.76 + 0.28 * cellDensity + 0.22 * v00.pinchProximity) *
            taperDensity;

          if (rng() > connectProb) continue;

          const v10 = grid[i + 1][j];
          const v11 = grid[i + 1][j + 1];
          const v21 = i + 2 < numU ? grid[i + 2][j + 1] : null;
          const v20 = i + 2 < numU ? grid[i + 2][j] : null;
          const v31 = i + 3 < numU ? grid[i + 3][j + 1] : null;

          const parity = (i + j + (sideConfig.isRight ? 1 : 0)) % 2 === 0;

          if (parity) {
            let linked = connectVertices(v00, v11, cellDensity * 0.55);
            if (!linked && v21) linked = connectVertices(v00, v21, cellDensity * 0.50);
            if (!linked && v31) linked = connectVertices(v00, v31, cellDensity * 0.45);

            if (rng() < 0.76) {
              if (!connectVertices(v01, v10, cellDensity * 0.50) && v20) {
                connectVertices(v01, v20, cellDensity * 0.45);
              }
            }
          } else {
            let linked = connectVertices(v01, v10, cellDensity * 0.55);
            if (!linked && v20) linked = connectVertices(v01, v20, cellDensity * 0.50);

            if (rng() < 0.74) {
              if (!connectVertices(v00, v11, cellDensity * 0.50) && v21) {
                connectVertices(v00, v21, cellDensity * 0.45);
              }
            }
          }

          // Multi-span diagonal (j -> j+2 within same sheet) to form medium polygonal cells
          if (
            j + 2 < numV &&
            grid[i][j + 2].descriptor.streamId === v00.descriptor.streamId &&
            rng() < 0.42 * cellDensity
          ) {
            if (!connectVertices(v00, grid[i + 1][j + 2], cellDensity * 0.45) && i + 2 < numU) {
              connectVertices(v00, grid[i + 2][j + 2], cellDensity * 0.42);
            }
          }
        }
      }

      // Pass 3B: Continuous Inter-Sheet 3D Proximity Web (Joins Sheet 0, Sheet 1 & Sheet 2 across the volume)
      const bridgeMaxDist = 0.68 * layout.verticalScale;
      for (let i = 1; i < numU - 2; i++) {
        for (let jA = 0; jA < numV; jA++) {
          const vA = grid[i][jA];
          if (vA.edgeFade <= 0.04) continue;

          let bridgesFromA = 0;
          for (let jB = jA + 1; jB < numV && bridgesFromA < 2; jB++) {
            for (let di = 1; di <= 2; di++) {
              const vB = grid[i + di][jB];
              if (vA.descriptor.streamId === vB.descriptor.streamId) continue;
              if (vB.edgeFade <= 0.04) continue;

              const dx = Math.abs(vA.x - vB.x);
              const dy = Math.abs(vA.y - vB.y);
              const dz = Math.abs(vA.z - vB.z);
              const dist3D = Math.hypot(dx, dy, dz * 0.55);

              if (dist3D <= bridgeMaxDist && dy / Math.max(dx, 0.01) <= 1.15) {
                if (rng() < 0.62 + 0.30 * vA.pinchProximity) {
                  if (connectVertices(vA, vB, 0.68)) {
                    bridgesFromA++;
                    break;
                  }
                }
              }
            }
          }
        }
      }

      // 4. Populate Clearly Visible 3-Tier Connection Node System at Actual Mesh Intersections
      for (let i = 1; i < numU - 1; i++) {
        for (let j = 0; j < numV; j++) {
          const gv = grid[i][j];
          if (gv.edgeFade <= 0.04) continue;

          const desc = gv.descriptor;
          const deg = gv.degree;

          // Deep background out-of-focus bokeh nodes (Tier 3) in Layer 2 and outer canopy
          if (
            (layerIndex === 2 && (desc.role === 'canopy' || rng() < 0.22)) ||
            (layerIndex === 1 && desc.role === 'canopy' && rng() < 0.20)
          ) {
            pushNode(
              gv,
              [0.44, 0.62, 0.36, 0.08],
              gv.edgeFade * (0.42 + 0.28 * rng()),
              0.48 + 0.56 * rng(),
              3.0
            );
            continue;
          }

          // Beaded outer canopy boundary filament
          if (layerIndex === 0 && desc.isBeadedCanopy && i % 2 === 0 && gv.u < 0.78) {
            pushNode(
              gv,
              [0.84, 0.22, 0.24, 0.54],
              gv.edgeFade * (0.84 + 0.14 * rng()),
              0.19 + 0.08 * rng(),
              i % 6 === 0 ? 1.0 : 0.0
            );
            continue;
          }

          // Require actual mesh intersection connectivity (deg >= 2)
          if (deg < 2) continue;

          const app = computeVertexAppearance(gv, desc, layerIndex, 'filament');

          // Tier 1: Medium luminous nodes at important branching junctions (deg >= 3 or hero junctions)
          const isMediumHub =
            (layerIndex === 0 && deg >= 3 && (gv.heroJunction >= 1 || rng() < 0.58)) ||
            (layerIndex === 0 &&
              desc.isPrimaryHero &&
              deg >= 2 &&
              (gv.pinchProximity > 0.34 || gv.crestProximity > 0.36) &&
              rng() < 0.45) ||
            (layerIndex === 1 && deg >= 3 && rng() < 0.36);

          if (isMediumHub) {
            const accentMix = desc.role === 'accent' ? 0.88 : 0.18 + 0.28 * rng();
            pushNode(
              gv,
              [0.88, 0.16, accentMix, 0.72],
              gv.edgeFade * (0.88 + 0.12 * rng()),
              0.24 + 0.11 * rng() + 0.015 * Math.min(deg, 5),
              1.0
            );
          } else {
            // Tier 0: Numerous small crisp luminous nodes at actual mesh intersections
            const smallNodeProb =
              layerIndex === 0
                ? Math.min(0.68, 0.32 + 0.09 * deg + 0.20 * gv.pinchProximity)
                : layerIndex === 1
                ? Math.min(0.44, 0.18 + 0.07 * deg)
                : 0.14;

            if (rng() < smallNodeProb) {
              pushNode(
                gv,
                [
                  Math.max(0.76, app.weights[0]),
                  app.weights[1] * 0.45,
                  app.weights[2],
                  0.42 + 0.28 * gv.pinchProximity,
                ],
                gv.edgeFade * (0.80 + 0.18 * rng()),
                0.14 + 0.065 * rng(),
                0.0
              );
            }
          }
        }
      }

      // 5. Place Asymmetric Focal Highlight Nodes (Tier 2) & Restrained Glow Halos (Tier 3) in Layer 0
      if (layerIndex === 0) {
        const highlightTargets = sideConfig.isRight
          ? [
              // Right formation focal nexuses (matching TARGET_REFERENCE right side):
              { uTarget: 0.180, streamId: 0, streamV: 0.82, size: 0.84, intensity: 1.00, accent: 0.10, pool: true },
              { uTarget: 0.340, streamId: 0, streamV: 0.48, size: 0.90, intensity: 1.00, accent: 0.12, pool: true },
              { uTarget: 0.480, streamId: 0, streamV: 0.16, size: 0.86, intensity: 0.98, accent: 0.14, pool: true },
              { uTarget: 0.150, streamId: 2, streamV: 0.00, size: 0.78, intensity: 0.96, accent: 0.88, pool: true },
              { uTarget: 0.530, streamId: 2, streamV: 0.20, size: 0.68, intensity: 0.94, accent: 0.92, pool: true },
              { uTarget: 0.680, streamId: 1, streamV: 0.80, size: 0.58, intensity: 0.90, accent: 0.54, pool: false },
              { uTarget: 0.040, streamId: 0, streamV: 0.48, size: 0.58, intensity: 0.90, accent: 0.12, pool: false },
              { uTarget: 0.240, streamId: 2, streamV: 0.00, size: 0.56, intensity: 0.88, accent: 0.90, pool: false },
              { uTarget: 0.410, streamId: 1, streamV: 0.80, size: 0.54, intensity: 0.88, accent: 0.22, pool: false },
            ]
          : [
              // Left formation focal nexuses (matching TARGET_REFERENCE left side):
              { uTarget: 0.340, streamId: 0, streamV: 0.52, size: 0.92, intensity: 1.00, accent: 0.12, pool: true },
              { uTarget: 0.140, streamId: 1, streamV: 0.22, size: 0.88, intensity: 1.00, accent: 0.16, pool: true },
              { uTarget: 0.530, streamId: 0, streamV: 0.18, size: 0.78, intensity: 0.96, accent: 0.12, pool: true },
              { uTarget: 0.515, streamId: 1, streamV: 0.82, size: 0.74, intensity: 0.95, accent: 0.14, pool: true },
              { uTarget: 0.370, streamId: 2, streamV: 0.00, size: 0.64, intensity: 0.92, accent: 0.94, pool: true },
              { uTarget: 0.675, streamId: 2, streamV: 0.20, size: 0.62, intensity: 0.90, accent: 0.88, pool: false },
              { uTarget: 0.038, streamId: 0, streamV: 0.52, size: 0.58, intensity: 0.90, accent: 0.10, pool: false },
              { uTarget: 0.220, streamId: 0, streamV: 0.80, size: 0.56, intensity: 0.88, accent: 0.14, pool: false },
              { uTarget: 0.420, streamId: 1, streamV: 0.82, size: 0.54, intensity: 0.88, accent: 0.20, pool: false },
            ];

        highlightTargets.forEach((target) => {
          const iSearchMin = Math.max(1, Math.round((target.uTarget - 0.05) * (numU - 1)));
          const iSearchMax = Math.min(numU - 2, Math.round((target.uTarget + 0.05) * (numU - 1)));

          let bestVertex = null;
          let bestScore = Infinity;

          for (let i = iSearchMin; i <= iSearchMax; i++) {
            for (let j = 0; j < numV; j++) {
              const vCand = grid[i][j];
              const d = vCand.descriptor;
              const uDiff = Math.abs(vCand.u - target.uTarget);
              const streamPenalty = Math.abs(d.streamId - target.streamId) * 0.45;
              const vDiff = Math.abs(d.streamV - target.streamV) * 0.35;
              const degreeBonus = Math.min(vCand.degree, 5) * 0.035 + (d.isPrimaryHero ? 0.06 : 0.0);

              const score = uDiff + streamPenalty + vDiff - degreeBonus;
              if (score < bestScore) {
                bestScore = score;
                bestVertex = vCand;
              }
            }
          }

          if (bestVertex) {
            pushNode(
              bestVertex,
              [0.88 * (1.0 - target.accent * 0.55), 0.16, target.accent, 1.00],
              target.intensity,
              target.size,
              2.0
            );

            if (target.pool) {
              pushNode(
                bestVertex,
                [0.74 * (1.0 - target.accent * 0.5), 0.34, target.accent * 0.88, 0.36],
                target.intensity * 0.44,
                target.size * 2.25,
                3.0
              );
            }
          }
        });
      }
    });
  });

  // Assemble Three.js BufferGeometries
  const buildLineBufferGeometry = (buf) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
    geo.setAttribute('aBasePosition', new THREE.Float32BufferAttribute(buf.basePositions, 3));
    geo.setAttribute('aColorWeights', new THREE.Float32BufferAttribute(buf.colorWeights, 4));
    geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(buf.alphas, 1));
    geo.setAttribute('aUvParam', new THREE.Float32BufferAttribute(buf.uvParams, 2));
    geo.setAttribute('aMeta', new THREE.Float32BufferAttribute(buf.metas, 4));
    geo.computeBoundingSphere();
    return geo;
  };

  const layerGeometries = layerLineBuffers.map(buildLineBufferGeometry);

  const heroRibbonGeometry = new THREE.BufferGeometry();
  heroRibbonGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(heroRibbonData.positions, 3)
  );
  heroRibbonGeometry.setAttribute(
    'aBasePosition',
    new THREE.Float32BufferAttribute(heroRibbonData.basePositions, 3)
  );
  heroRibbonGeometry.setAttribute(
    'aColorWeights',
    new THREE.Float32BufferAttribute(heroRibbonData.colorWeights, 4)
  );
  heroRibbonGeometry.setAttribute(
    'aAlpha',
    new THREE.Float32BufferAttribute(heroRibbonData.alphas, 1)
  );
  heroRibbonGeometry.setAttribute(
    'aCross',
    new THREE.Float32BufferAttribute(heroRibbonData.crossCoords, 1)
  );
  heroRibbonGeometry.setAttribute(
    'aUvParam',
    new THREE.Float32BufferAttribute(heroRibbonData.uvParams, 2)
  );
  heroRibbonGeometry.setAttribute(
    'aMeta',
    new THREE.Float32BufferAttribute(heroRibbonData.metas, 4)
  );
  heroRibbonGeometry.setIndex(heroRibbonData.indices);
  heroRibbonGeometry.computeBoundingSphere();

  const nodeGeometry = new THREE.BufferGeometry();
  nodeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nodeData.positions, 3));
  nodeGeometry.setAttribute(
    'aBasePosition',
    new THREE.Float32BufferAttribute(nodeData.basePositions, 3)
  );
  nodeGeometry.setAttribute(
    'aColorWeights',
    new THREE.Float32BufferAttribute(nodeData.colorWeights, 4)
  );
  nodeGeometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(nodeData.alphas, 1));
  nodeGeometry.setAttribute('aNodeSize', new THREE.Float32BufferAttribute(nodeData.sizes, 1));
  nodeGeometry.setAttribute('aNodeTier', new THREE.Float32BufferAttribute(nodeData.tiers, 1));
  nodeGeometry.setAttribute('aUvParam', new THREE.Float32BufferAttribute(nodeData.uvParams, 2));
  nodeGeometry.setAttribute('aMeta', new THREE.Float32BufferAttribute(nodeData.metas, 4));
  nodeGeometry.computeBoundingSphere();

  return {
    layerGeometries,
    heroRibbonGeometry,
    nodeGeometry,
    canonicalVertices,
  };
}

/* ============================================================================
 * FILE 4: src/components/neural-wire/neuralWireParticles.js
 * High-density batched Points particle field with multi-size, multi-opacity,
 * and multi-Z-depth distribution across 4 spatial zones.
 * ========================================================================== */

export function generateNeuralWireParticles(canonicalVertices, layout) {
  const rng = createSeededRandom(9021088);
  const totalParticles = Math.round(11200 * layout.densityScale);

  const positions = new Float32Array(totalParticles * 3);
  const basePositions = new Float32Array(totalParticles * 3);
  const colorWeights = new Float32Array(totalParticles * 4);
  const alphas = new Float32Array(totalParticles);
  const sizes = new Float32Array(totalParticles);
  const uvParams = new Float32Array(totalParticles * 2);

  // Separate anchor pools so particles densely envelop the mesh sheets and intersections
  const activeMeshAnchors = canonicalVertices.filter(
    (v) => v.u >= 0.01 && v.u <= 0.96 && v.edgeFade > 0.06
  );
  const richMeshAnchors = activeMeshAnchors.filter(
    (v) => v.layerIndex <= 1 && (v.degree >= 2 || v.descriptor.isPrimaryHero)
  );

  const primaryPool =
    richMeshAnchors.length > 0 ? richMeshAnchors : activeMeshAnchors;
  const generalPool =
    activeMeshAnchors.length > 0 ? activeMeshAnchors : canonicalVertices;

  for (let i = 0; i < totalParticles; i++) {
    const zoneRoll = rng();
    const pool = zoneRoll < 0.60 ? primaryPool : generalPool;
    const anchor = pool[Math.floor(rng() * pool.length)];

    let px = anchor.x;
    let py = anchor.y;
    let pz = anchor.z;
    let alpha = 0.56;
    let size = 0.054;
    let wParticle = 0.80;
    let wSecondary = 0.36;
    let wAccent = anchor.descriptor.role === 'accent' ? 0.72 : 0.18 * rng();
    let wHighlight = 0.10;

    if (zoneRoll < 0.58) {
      // Zone 1 (58%): Abundant crisp micro-particles around primary wires & mesh cells
      const radialAngle = rng() * Math.PI * 2.0;
      const radialDist = 0.04 + 0.42 * Math.pow(rng(), 1.45);
      px += Math.cos(radialAngle) * radialDist * 1.20;
      py += Math.sin(radialAngle) * radialDist * 0.30 * layout.verticalScale;
      pz += (rng() - 0.5) * 0.38;

      size = 0.042 + 0.054 * Math.pow(rng(), 1.85);
      alpha = (0.40 + 0.38 * rng()) * Math.pow(anchor.edgeFade, 0.85);

      if (rng() < 0.16) {
        wHighlight = 0.54 + 0.36 * rng();
        alpha = Math.min(0.88, alpha * 1.22);
        size *= 1.18;
      }
    } else if (zoneRoll < 0.86) {
      // Zone 2 (28%): Suspended micro-particles between overlapping 3D depth layers
      px += (rng() - 0.5) * 0.92;
      py += (rng() - 0.5) * 0.42 * layout.verticalScale;
      pz -= 0.15 + rng() * 2.85;

      size = 0.040 + 0.048 * Math.pow(rng(), 1.80);
      alpha = (0.30 + 0.34 * rng()) * Math.pow(anchor.edgeFade, 0.88);
      wSecondary = 0.58;
      wAccent = Math.max(wAccent, 0.32 * rng());
    } else if (zoneRoll < 0.96) {
      // Zone 3 (10%): Delicate spore trails following the outer canopy curvature
      const dirY = anchor.y >= 0 ? 1.0 : -1.0;
      px += (rng() - 0.5) * 1.10;
      py += dirY * (0.08 + 0.36 * Math.pow(rng(), 1.45)) * layout.verticalScale;
      pz -= 0.22 + rng() * 3.0;

      size = 0.038 + 0.044 * rng();
      alpha = (0.24 + 0.28 * rng()) * Math.pow(anchor.edgeFade, 0.84);
      wSecondary = 0.64;
      wAccent = 0.34;
    } else {
      // Zone 4 (4%): Sparse background particles in deep surrounding space
      const sideSign = rng() < 0.5 ? -1.0 : 1.0;
      const minX = layout.innerGapHalfWidth * 1.15;
      px = sideSign * (minX + Math.pow(rng(), 0.74) * (layout.outerExtentX - minX));
      py = (rng() - 0.5) * layout.verticalScale * 1.65;
      pz = -1.0 - rng() * 3.6;

      size = 0.040 + 0.048 * Math.pow(rng(), 2.1);
      alpha = 0.16 + 0.22 * rng();
      wSecondary = 0.78;
    }

    const i3 = i * 3;
    const i4 = i * 4;
    const i2 = i * 2;

    positions[i3] = px;
    positions[i3 + 1] = py;
    positions[i3 + 2] = pz;

    basePositions[i3] = px;
    basePositions[i3 + 1] = py;
    basePositions[i3 + 2] = pz;

    colorWeights[i4] = wParticle;
    colorWeights[i4 + 1] = wSecondary;
    colorWeights[i4 + 2] = wAccent;
    colorWeights[i4 + 3] = wHighlight;

    alphas[i] = alpha;
    sizes[i] = size;

    uvParams[i2] = anchor.u;
    uvParams[i2 + 1] = anchor.v;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aBasePosition', new THREE.BufferAttribute(basePositions, 3));
  geometry.setAttribute('aColorWeights', new THREE.BufferAttribute(colorWeights, 4));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('aParticleSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aUvParam', new THREE.BufferAttribute(uvParams, 2));
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Computes world-space visible frustum dimensions at Z = 0 for a PerspectiveCamera.
 */
export function computeFrustumDimensions(pixelWidth, pixelHeight, fovDeg = 34, cameraZ = 16) {
  const safeW = Math.max(pixelWidth || 1425, 1);
  const safeH = Math.max(pixelHeight || 500, 1);
  const aspect = safeW / safeH;
  const vFovRad = THREE.MathUtils.degToRad(fovDeg);
  const visibleHeight = 2.0 * Math.tan(vFovRad * 0.5) * cameraZ;
  const visibleWidth = visibleHeight * aspect;
  return {
    viewportWidth: visibleWidth,
    viewportHeight: visibleHeight,
    aspect,
  };
}

/* ============================================================================
 * FILE 5: src/components/neural-wire/NeuralWireField.jsx
 * Main R3F scene component. Mountable inside any existing React Three Fiber Canvas.
 * ========================================================================== */

export function NeuralWireField({
  theme = DEFAULT_NEURAL_WIRE_THEME,
  position = [0, 0, 0],
  scale = 1,
  viewportWidth,
  viewportHeight,
  pixelRatio,
}) {
  const [windowSize, setWindowSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1425,
    height: typeof window !== 'undefined' ? Math.round(window.innerWidth / 2.85) : 500,
    dpr: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const derivedFrustum = useMemo(
    () => computeFrustumDimensions(windowSize.width, windowSize.height, 34, 16),
    [windowSize.width, windowSize.height]
  );

  const activeViewportWidth = viewportWidth ?? derivedFrustum.viewportWidth;
  const activeViewportHeight = viewportHeight ?? derivedFrustum.viewportHeight;
  const activePixelRatio = pixelRatio ?? windowSize.dpr;

  const quantizedWidth = Math.round(activeViewportWidth * 2) / 2;
  const quantizedHeight = Math.round(activeViewportHeight * 2) / 2;

  const layout = useMemo(
    () => computeResponsiveLayout(quantizedWidth, quantizedHeight),
    [quantizedWidth, quantizedHeight]
  );

  const { layerGeometries, heroRibbonGeometry, nodeGeometry, particleGeometry } = useMemo(() => {
    const wireGeo = generateNeuralWireGeometry(layout);
    const partGeo = generateNeuralWireParticles(wireGeo.canonicalVertices, layout);
    return {
      ...wireGeo,
      particleGeometry: partGeo,
    };
  }, [layout]);

  const resolvedTheme = useMemo(() => resolveNeuralWireTheme(theme), [theme]);

  const materials = useMemo(
    () => createNeuralWireMaterials(resolvedTheme, activePixelRatio),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    updateNeuralWireMaterials(materials, resolvedTheme, activePixelRatio);
  }, [materials, resolvedTheme, activePixelRatio]);

  useEffect(() => {
    return () => {
      layerGeometries.forEach((g) => g.dispose());
      heroRibbonGeometry.dispose();
      nodeGeometry.dispose();
      particleGeometry.dispose();
    };
  }, [layerGeometries, heroRibbonGeometry, nodeGeometry, particleGeometry]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((m) => m && m.dispose && m.dispose());
    };
  }, [materials]);

  return (
    <group name="neural-wire-field-root" position={position} scale={scale}>
      {/* Deep Supporting Mesh Layer 2 */}
      <lineSegments
        name="neural-wire-layer-2"
        geometry={layerGeometries[2]}
        material={materials.layer2WireMaterial}
        frustumCulled={false}
      />

      {/* Mid-Depth Supporting Mesh Layer 1 */}
      <lineSegments
        name="neural-wire-layer-1"
        geometry={layerGeometries[1]}
        material={materials.layer1WireMaterial}
        frustumCulled={false}
      />

      {/* Batched Multi-Zone Suspended Micro-Dust Particle System */}
      <points
        name="neural-wire-particles"
        geometry={particleGeometry}
        material={materials.particleMaterial}
        frustumCulled={false}
      />

      {/* Dominant Foreground Mesh Layer 0 (Primary, Secondary & Irregular Mesh Cells) */}
      <lineSegments
        name="neural-wire-layer-0"
        geometry={layerGeometries[0]}
        material={materials.layer0WireMaterial}
        frustumCulled={false}
      />

      {/* Luminous Primary Hero Filament Ribbons */}
      <mesh
        name="neural-wire-hero-ribbons"
        geometry={heroRibbonGeometry}
        material={materials.heroRibbonMaterial}
        frustumCulled={false}
      />

      {/* Degree-Aligned 3-Tier Connection Node System + Background Bokeh Nodes */}
      <points
        name="neural-wire-nodes"
        geometry={nodeGeometry}
        material={materials.nodeMaterial}
        frustumCulled={false}
      />
    </group>
  );
}

/* ============================================================================
 * FILE 6: src/components/neural-wire/NeuralWirePreview.jsx
 * Standalone panoramic (~2.85:1) WebGL preview harness.
 * ========================================================================== */

export function NeuralWirePreview({
  theme = DEFAULT_NEURAL_WIRE_THEME,
  enableBloom = true,
  targetAspect = 3.0,
  className = '',
  style = {},
}) {
  const outerWrapRef = useRef(null);
  const stageRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);

  const [stageMetrics, setStageMetrics] = useState({
    width: 1425,
    height: 500,
    dpr: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
  });

  const effectiveTheme = useMemo(() => {
    if (enableBloom) return theme;
    return {
      ...DEFAULT_NEURAL_WIRE_THEME,
      ...(theme || {}),
      glowIntensity:
        ((theme && theme.glowIntensity) ?? DEFAULT_NEURAL_WIRE_THEME.glowIntensity) * 0.55,
    };
  }, [theme, enableBloom]);

  const resolvedTheme = useMemo(() => resolveNeuralWireTheme(effectiveTheme), [effectiveTheme]);

  const frustum = useMemo(
    () => computeFrustumDimensions(stageMetrics.width, stageMetrics.height, 34, 16),
    [stageMetrics.width, stageMetrics.height]
  );

  const quantizedWidth = Math.round(frustum.viewportWidth * 2) / 2;
  const quantizedHeight = Math.round(frustum.viewportHeight * 2) / 2;

  const layout = useMemo(
    () => computeResponsiveLayout(quantizedWidth, quantizedHeight),
    [quantizedWidth, quantizedHeight]
  );

  const { layerGeometries, heroRibbonGeometry, nodeGeometry, particleGeometry } = useMemo(() => {
    const wireGeo = generateNeuralWireGeometry(layout);
    const partGeo = generateNeuralWireParticles(wireGeo.canonicalVertices, layout);
    return {
      ...wireGeo,
      particleGeometry: partGeo,
    };
  }, [layout]);

  const materials = useMemo(
    () => createNeuralWireMaterials(resolvedTheme, stageMetrics.dpr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    const stageEl = stageRef.current;
    const outerEl = outerWrapRef.current;
    if (!stageEl || !outerEl) return undefined;

    const computeStageSize = () => {
      const availW = Math.max(outerEl.clientWidth || window.innerWidth || 1280, 320);
      const availH = Math.max(outerEl.clientHeight || window.innerHeight || 720, 240);

      const effectiveAspect = availW < 560 ? Math.max(availW / availH, 1.85) : targetAspect;

      let stageW = availW;
      let stageH = Math.round(stageW / effectiveAspect);

      if (stageH > availH) {
        stageH = availH;
        stageW = Math.round(stageH * effectiveAspect);
      }

      return {
        width: Math.max(stageW, 1),
        height: Math.max(stageH, 1),
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      };
    };

    const initial = computeStageSize();
    stageEl.style.width = `${initial.width}px`;
    stageEl.style.height = `${initial.height}px`;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#000000');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      34,
      initial.width / Math.max(initial.height, 1),
      0.1,
      100
    );
    camera.position.set(0, 0, 16);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(initial.dpr);
    renderer.setSize(initial.width, initial.height, false);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    stageEl.innerHTML = '';
    stageEl.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    setStageMetrics(initial);

    const handleResize = () => {
      if (!outerWrapRef.current || !stageRef.current || !rendererRef.current || !cameraRef.current) {
        return;
      }
      const next = computeStageSize();
      stageRef.current.style.width = `${next.width}px`;
      stageRef.current.style.height = `${next.height}px`;

      cameraRef.current.aspect = next.width / Math.max(next.height, 1);
      cameraRef.current.updateProjectionMatrix();

      rendererRef.current.setPixelRatio(next.dpr);
      rendererRef.current.setSize(next.width, next.height, false);
      rendererRef.current.render(sceneRef.current, cameraRef.current);

      setStageMetrics((prev) => {
        if (
          Math.abs(prev.width - next.width) < 4 &&
          Math.abs(prev.height - next.height) < 4 &&
          prev.dpr === next.dpr
        ) {
          return prev;
        }
        return next;
      });
    };

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(outerEl);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [targetAspect]);

  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!scene || !renderer || !camera) return undefined;

    const rootGroup = new THREE.Group();
    rootGroup.name = 'neural-wire-field-root';

    const layer2Lines = new THREE.LineSegments(layerGeometries[2], materials.layer2WireMaterial);
    layer2Lines.frustumCulled = false;

    const layer1Lines = new THREE.LineSegments(layerGeometries[1], materials.layer1WireMaterial);
    layer1Lines.frustumCulled = false;

    const particlePoints = new THREE.Points(particleGeometry, materials.particleMaterial);
    particlePoints.frustumCulled = false;

    const layer0Lines = new THREE.LineSegments(layerGeometries[0], materials.layer0WireMaterial);
    layer0Lines.frustumCulled = false;

    const heroRibbonMesh = new THREE.Mesh(heroRibbonGeometry, materials.heroRibbonMaterial);
    heroRibbonMesh.frustumCulled = false;

    const nodePoints = new THREE.Points(nodeGeometry, materials.nodeMaterial);
    nodePoints.frustumCulled = false;

    rootGroup.add(
      layer2Lines,
      layer1Lines,
      particlePoints,
      layer0Lines,
      heroRibbonMesh,
      nodePoints
    );
    scene.add(rootGroup);

    renderer.render(scene, camera);

    return () => {
      scene.remove(rootGroup);
    };
  }, [layerGeometries, heroRibbonGeometry, nodeGeometry, particleGeometry, materials]);

  useEffect(() => {
    updateNeuralWireMaterials(materials, resolvedTheme, stageMetrics.dpr);
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [materials, resolvedTheme, stageMetrics.dpr]);

  useEffect(() => {
    return () => {
      layerGeometries.forEach((g) => g.dispose());
      heroRibbonGeometry.dispose();
      nodeGeometry.dispose();
      particleGeometry.dispose();
    };
  }, [layerGeometries, heroRibbonGeometry, nodeGeometry, particleGeometry]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((m) => m && m.dispose && m.dispose());
    };
  }, [materials]);

  return (
    <div
      ref={outerWrapRef}
      className={className}
      style={{
        width: '100%',
        height: '100vh',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        margin: 0,
        padding: 0,
        ...style,
      }}
    >
      <div
        ref={stageRef}
        style={{
          position: 'relative',
          backgroundColor: '#000000',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}

export default NeuralWirePreview;