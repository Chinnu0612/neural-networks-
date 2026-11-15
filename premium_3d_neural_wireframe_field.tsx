/**
 * PREMIUM 3D NEURAL WIREFRAME FIELD — FINAL VISUAL REFINEMENT
 * Standalone React Three Fiber / Three.js Procedural Graphics Implementation
 *
 * Stack:
 *   React 19.2.6 · Three.js 0.184.0 · @react-three/fiber 9.6.1
 *   Language: JSX / JavaScript (no TypeScript)
 *
 * Phase 1 — Static implementation, animation-ready architecture.
 * All six logical modules are inline in this single file.
 *
 * Fixes applied vs. previous version:
 *   DEF-01  Triangulation pass replaced with organic probability-weighted cells
 *   DEF-02  Accent color weight clamped; secondary base color shifted to pure electric-blue
 *   DEF-03  Guide-curve amplitudes & envelope reshaped for proper S-curve silhouette
 *   DEF-04  Hero ribbons replaced by plain LineSegments — crisp single-pixel strands
 *   DEF-05  Highlight node counts balanced; shared density logic per side
 *   DEF-06  Nexus-proximity density boost added to triangulation probability
 *   DEF-07  Hard clamp enforced — no geometry inside |x| < innerGapHalfWidth
 *   DEF-08  Strand counts increased; connection opacity floor raised
 *   DEF-09  Starburst removed — Tier 2 node size capped; no co-located Tier 3 bokeh
 *   DEF-10  Sheet curvature frequencies spread apart; wave-within-wave silhouette restored
 */

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ============================================================================
 * MODULE 1 — THEME
 * Centralized dark-tech palette. All colors come from here.
 * Supports partial override for external theme selectors.
 * ========================================================================== */

export const DEFAULT_NEURAL_WIRE_THEME = Object.freeze({
  primaryWireColor:   '#1ad0ff',  // Electric cyan — primary optical-fiber filaments
  secondaryWireColor: '#1055cc',  // Deep electric blue — secondary strands (shifted from #1862ed to avoid purple cast under additive blending)
  accentWireColor:    '#a030f0',  // Violet — selective accent only (capped at 20% luminance share)
  nodeColor:          '#72ecff',  // Ice-cyan — small/medium intersection nodes
  highlightNodeColor: '#f0faff',  // White-blue — highlight nexus cores
  particleColor:      '#3aabff',  // Electric sky-blue — particle field
  opacity:            1.0,
  glowIntensity:      1.0,
});

export function resolveNeuralWireTheme(customTheme = {}) {
  const merged = { ...DEFAULT_NEURAL_WIRE_THEME, ...(customTheme || {}) };
  return {
    raw: merged,
    colors: {
      primaryWire:   new THREE.Color(merged.primaryWireColor),
      secondaryWire: new THREE.Color(merged.secondaryWireColor),
      accentWire:    new THREE.Color(merged.accentWireColor),
      node:          new THREE.Color(merged.nodeColor),
      highlightNode: new THREE.Color(merged.highlightNodeColor),
      particle:      new THREE.Color(merged.particleColor),
    },
    opacity:       THREE.MathUtils.clamp(Number(merged.opacity      ?? 1.0), 0.0, 2.0),
    glowIntensity: THREE.MathUtils.clamp(Number(merged.glowIntensity ?? 1.0), 0.0, 2.5),
  };
}

/* ============================================================================
 * MODULE 2 — MATERIALS
 * Three custom GLSL ShaderMaterials:
 *   wireMat      — LineSegments for all filaments (primary + secondary + mesh)
 *   nodeMat      — Points for 3-tier node system
 *   particleMat  — Points for particle field
 *
 * Hero ribbons from previous version replaced by plain LineSegments
 * using wireMat with higher alpha — this eliminates the thick-band artifact (DEF-04).
 * ========================================================================== */

// ---- Wire shader ----------------------------------------------------------
const WIRE_VERT = /* glsl */`
  attribute vec4  aColorWeights; // x:primary  y:secondary  z:accent  w:highlight
  attribute float aAlpha;
  attribute vec3  aBasePosition; // Phase-2 animation origin
  attribute vec2  aUvParam;      // normalized (u,v) parametric coords
  attribute vec4  aMeta;         // x:sideSign  y:layerIndex  z:strandIndex  w:nexusFactor

  uniform vec3  uPrimaryColor;
  uniform vec3  uSecondaryColor;
  uniform vec3  uAccentColor;
  uniform vec3  uHighlightColor;
  uniform float uOpacity;
  uniform float uGlowIntensity;
  uniform float uLayerOpacityScale;

  // Phase 2 — Animation uniforms
  uniform float uTime;
  uniform float uAnimationIntensity;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // Phase 2: organic vertex displacement based on parametric coordinates
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
      float secondaryPhase = u * 3.14159 * 2.3 - v * 1.7 + sideSign * 0.8;
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

    // Depth-cue: front layers slightly brighter
    float depthFactor = clamp((pos.z + 4.5) / 5.5, 0.30, 1.15);

    // Clamp accent contribution to prevent violet dominance (DEF-02)
    float accentW = clamp(aColorWeights.z, 0.0, 0.85);
    float accentBoost = clamp(accentW * 1.1, 0.0, 0.65);

    vec3 blended =
      uPrimaryColor   * aColorWeights.x +
      uSecondaryColor * aColorWeights.y +
      uAccentColor    * accentW          +
      uHighlightColor * aColorWeights.w;

    // Depth tint — keep accent hue when it's intentional
    vec3 depthTinted = mix(
      uSecondaryColor * 0.7,
      blended,
      clamp(max(depthFactor, accentBoost * 0.8), 0.35, 1.0)
    );

    float nexusBoost = 1.0 + (aColorWeights.w * 0.6 + aMeta.w * 0.35) * uGlowIntensity;
    vColor = depthTinted * nexusBoost * mix(0.72, 1.18, depthFactor);
    vAlpha = clamp(
      aAlpha * uOpacity * uLayerOpacityScale * mix(0.60, 1.0, depthFactor),
      0.0, 1.0
    );

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const WIRE_FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    if (vAlpha <= 0.004) discard;
    gl_FragColor = vec4(vColor * vAlpha, vAlpha);
  }
`;

// ---- Node shader ----------------------------------------------------------
const NODE_VERT = /* glsl */`
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

  // Phase 2 — Animation uniforms
  uniform float uTime;
  uniform float uAnimationIntensity;

  varying vec3  vColor;
  varying vec3  vCoreColor;
  varying float vAlpha;
  varying float vTier;

  void main() {
    // Phase 2: apply same deformation as wires so nodes stay attached
    vec3 pos = aBasePosition;
    
    if (uAnimationIntensity > 0.001) {
      float u = aUvParam.x;
      float v = aUvParam.y;
      float sideSign = aMeta.x;
      float layerIndex = aMeta.y;
      
      float anchorFade = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.92, 1.0, u));
      
      float primaryPhase = u * 3.14159 * 1.8 + v * 2.2 + layerIndex * 0.6;
      float primaryWave = sin(uTime * 0.52 + primaryPhase);
      
      float secondaryPhase = u * 3.14159 * 2.3 - v * 1.7 + sideSign * 0.8;
      float secondaryWave = sin(uTime * 0.39 + secondaryPhase) * 0.4;
      
      float yDisplacement = (primaryWave + secondaryWave) * anchorFade * uAnimationIntensity * 0.15;
      
      float depthPhase = u * 3.14159 * 1.2 + v * 1.5 + layerIndex * 1.2;
      float depthWave = sin(uTime * 0.31 + depthPhase);
      float zDisplacement = depthWave * anchorFade * uAnimationIntensity * 0.08;
      
      pos.y += yDisplacement;
      pos.z += zDisplacement;
    }

    vec4 mv  = modelViewMatrix * vec4(pos, 1.0);

    vec3 baseTint =
      uNodeColor      * aColorWeights.x +
      uSecondaryColor * aColorWeights.y +
      uAccentColor    * clamp(aColorWeights.z, 0.0, 0.5) +
      uHighlightColor * aColorWeights.w;

    vColor     = baseTint;
    vCoreColor = uHighlightColor;
    vAlpha     = clamp(aAlpha * uOpacity, 0.0, 1.0);
    vTier      = aNodeTier;

    float ps = 340.0 / max(-mv.z, 1.0);
    gl_PointSize = clamp(aNodeSize * ps * uPixelRatio, 3.2, 80.0); // cap at 80 — no giant starbursts (DEF-09)
    gl_Position  = projectionMatrix * mv;
  }
`;

const NODE_FRAG = /* glsl */`
  uniform float uGlowIntensity;

  varying vec3  vColor;
  varying vec3  vCoreColor;
  varying float vAlpha;
  varying float vTier;

  void main() {
    vec2  uv = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    if (r2 > 1.0 || vAlpha <= 0.004) discard;
    float r = sqrt(r2);

    float intensity = 0.0;
    vec3  col = vColor;

    if (vTier < 0.5) {
      // Tier 0 — small crisp dot (synaptic point)
      float core = exp(-r2 * 14.0) * 1.6;
      float halo = exp(-r2 * 3.0) * 0.50;
      intensity   = core + halo;
      col = mix(vColor, vCoreColor, clamp(core * 0.75, 0.0, 0.92));
    } else if (vTier < 1.5) {
      // Tier 1 — medium junction dot
      float core  = exp(-r2 * 20.0) * 1.9;
      float inner = exp(-r2 * 4.8) * 0.80;
      float outer = exp(-r2 * 1.8) * 0.38 * uGlowIntensity;
      intensity    = core + inner + outer;
      col = mix(vColor, vCoreColor, clamp(core * 0.86, 0.0, 0.96));
    } else if (vTier < 2.5) {
      // Tier 2 — highlight nexus: crisp center, NO spike artifact (DEF-09)
      float core  = exp(-r2 * 34.0) * 2.2;
      float bloom = exp(-r2 * 7.0) * 1.1;
      float soft  = exp(-r2 * 2.0) * 0.52 * uGlowIntensity;
      intensity    = core + bloom + soft;
      col = mix(vColor, vCoreColor, clamp(core * 0.92 + bloom * 0.28, 0.0, 0.99));
    } else {
      // Tier 3 — background bokeh
      float disc = smoothstep(1.0, 0.1, r) * exp(-r2 * 1.6);
      intensity   = disc * 0.4;
      col = vColor;
    }

    float a = clamp(intensity * vAlpha, 0.0, 1.0);
    if (a <= 0.003) discard;
    gl_FragColor = vec4(col * a, a);
  }
`;

// ---- Particle shader ------------------------------------------------------
const PARTICLE_VERT = /* glsl */`
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

  varying vec3  vColor;
  varying vec3  vHighColor;
  varying float vAlpha;
  varying float vHighW;

  void main() {
    vec3 pos = position;
    vec4 mv  = modelViewMatrix * vec4(pos, 1.0);

    vec3 tint =
      uParticleColor  * aColorWeights.x +
      uSecondaryColor * aColorWeights.y +
      uAccentColor    * clamp(aColorWeights.z, 0.0, 0.4) +
      uHighlightColor * aColorWeights.w;

    vColor  = tint * (1.1 + 0.15 * uGlowIntensity);
    vHighColor = uHighlightColor;
    vAlpha  = clamp(aAlpha * uOpacity, 0.0, 1.0);
    vHighW  = aColorWeights.w;

    float ps = 240.0 / max(-mv.z, 1.0);
    gl_PointSize = clamp(aParticleSize * ps * uPixelRatio, 1.5, 10.0);
    gl_Position  = projectionMatrix * mv;
  }
`;

const PARTICLE_FRAG = /* glsl */`
  varying vec3  vColor;
  varying vec3  vHighColor;
  varying float vAlpha;
  varying float vHighW;

  void main() {
    vec2  uv = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    if (r2 > 1.0 || vAlpha <= 0.004) discard;

    float core  = exp(-r2 * 7.0) * 1.1;
    float halo  = exp(-r2 * 2.2) * 0.32;
    float prof  = clamp(core + halo, 0.0, 1.0);
    float a     = clamp(prof * vAlpha, 0.0, 1.0);
    if (a <= 0.003) discard;

    vec3 col = mix(vColor, vHighColor, clamp(core * (0.22 + 0.46 * vHighW), 0.0, 0.88));
    gl_FragColor = vec4(col * a, a);
  }
`;

export function createNeuralWireMaterials(resolvedTheme, pixelRatio = 1) {
  const { colors, opacity, glowIntensity } = resolvedTheme;
  const dpr = Math.min(pixelRatio, 2);

  const makeWire = (layerOpacityScale) => new THREE.ShaderMaterial({
    vertexShader:   WIRE_VERT,
    fragmentShader: WIRE_FRAG,
    uniforms: {
      uPrimaryColor:      { value: colors.primaryWire.clone()   },
      uSecondaryColor:    { value: colors.secondaryWire.clone() },
      uAccentColor:       { value: colors.accentWire.clone()    },
      uHighlightColor:    { value: colors.highlightNode.clone() },
      uOpacity:           { value: opacity       },
      uGlowIntensity:     { value: glowIntensity },
      uLayerOpacityScale: { value: layerOpacityScale },
      uTime:              { value: 0.0 },  // Phase 2 animation
      uAnimationIntensity:{ value: 1.0 },  // Phase 2 animation
    },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  const nodeMaterial = new THREE.ShaderMaterial({
    vertexShader:   NODE_VERT,
    fragmentShader: NODE_FRAG,
    uniforms: {
      uPrimaryColor:   { value: colors.primaryWire.clone()   },
      uSecondaryColor: { value: colors.secondaryWire.clone() },
      uAccentColor:    { value: colors.accentWire.clone()    },
      uNodeColor:      { value: colors.node.clone()          },
      uHighlightColor: { value: colors.highlightNode.clone() },
      uOpacity:        { value: opacity       },
      uGlowIntensity:  { value: glowIntensity },
      uPixelRatio:     { value: dpr           },
      uTime:           { value: 0.0 },  // Phase 2 animation
      uAnimationIntensity:{ value: 1.0 },  // Phase 2 animation
    },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  const particleMaterial = new THREE.ShaderMaterial({
    vertexShader:   PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    uniforms: {
      uParticleColor:  { value: colors.particle.clone()      },
      uSecondaryColor: { value: colors.secondaryWire.clone() },
      uAccentColor:    { value: colors.accentWire.clone()    },
      uHighlightColor: { value: colors.highlightNode.clone() },
      uOpacity:        { value: opacity       },
      uGlowIntensity:  { value: glowIntensity },
      uPixelRatio:     { value: dpr           },
    },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  return {
    // 4 wire tiers: primaryMat (hero), layer0Mat (secondary), layer1Mat (mesh), layer2Mat (deep)
    primaryMat:     makeWire(1.00),   // Primary filaments — full opacity
    layer0Mat:      makeWire(0.85),   // Secondary filaments foreground
    layer1Mat:      makeWire(0.60),   // Triangulation mesh connections
    layer2Mat:      makeWire(0.38),   // Deep background strands
    nodeMaterial,
    particleMaterial,
  };
}

export function updateNeuralWireMaterials(materials, resolvedTheme, pixelRatio = 1) {
  if (!materials) return;
  const { colors, opacity, glowIntensity } = resolvedTheme;
  const dpr = Math.min(pixelRatio, 2);

  ['primaryMat', 'layer0Mat', 'layer1Mat', 'layer2Mat'].forEach((k) => {
    const m = materials[k];
    if (!m) return;
    m.uniforms.uPrimaryColor.value.copy(colors.primaryWire);
    m.uniforms.uSecondaryColor.value.copy(colors.secondaryWire);
    m.uniforms.uAccentColor.value.copy(colors.accentWire);
    m.uniforms.uHighlightColor.value.copy(colors.highlightNode);
    m.uniforms.uOpacity.value        = opacity;
    m.uniforms.uGlowIntensity.value  = glowIntensity;
  });

  if (materials.nodeMaterial) {
    const u = materials.nodeMaterial.uniforms;
    u.uPrimaryColor.value.copy(colors.primaryWire);
    u.uSecondaryColor.value.copy(colors.secondaryWire);
    u.uAccentColor.value.copy(colors.accentWire);
    u.uNodeColor.value.copy(colors.node);
    u.uHighlightColor.value.copy(colors.highlightNode);
    u.uOpacity.value       = opacity;
    u.uGlowIntensity.value = glowIntensity;
    u.uPixelRatio.value    = dpr;
  }

  if (materials.particleMaterial) {
    const u = materials.particleMaterial.uniforms;
    u.uParticleColor.value.copy(colors.particle);
    u.uSecondaryColor.value.copy(colors.secondaryWire);
    u.uAccentColor.value.copy(colors.accentWire);
    u.uHighlightColor.value.copy(colors.highlightNode);
    u.uOpacity.value       = opacity;
    u.uGlowIntensity.value = glowIntensity;
    u.uPixelRatio.value    = dpr;
  }
}

/* ============================================================================
 * MODULE 3 — GEOMETRY
 * Parametric 3D neural wire-mesh generator.
 *
 * Key design changes vs. previous:
 *
 *  1. Guide curves use wider-spread frequencies (Sheet 0: 1.3π, Sheet 1: 2.1π)
 *     producing the distinctive large-wave / tight-wave combination of TARGET_REFERENCE (DEF-10).
 *
 *  2. Hero filaments are emitted as plain LineSegments with elevated alpha instead
 *     of billboard quad ribbons — no thick band artifact (DEF-04).
 *
 *  3. Triangulation pass 3A uses organic probability that peaks inside enclosed
 *     wave chambers and falls at outer/inner boundaries (DEF-01, DEF-06).
 *
 *  4. Accent weight is capped at 0.4 on connection segments; on filaments it is
 *     strictly limited to Sheet 2 strands (DEF-02).
 *
 *  5. Hard clamp: x = sideSign * max(|computed x|, innerGapHalfWidth * 1.01)
 *     guarantees no geometry inside central gap (DEF-07).
 * ========================================================================== */

/** Mulberry32 deterministic PRNG */
export function createSeededRandom(seed = 1337) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computeResponsiveLayout(viewportWidth = 30, viewportHeight = 10) {
  const aspect = viewportWidth / Math.max(viewportHeight, 0.001);
  let tier = 'ultrawide';
  if      (aspect < 0.9 ) tier = 'mobile';
  else if (aspect < 1.55) tier = 'tablet';
  else if (aspect < 2.3 ) tier = 'desktop';

  const halfWidth        = viewportWidth * 0.5;
  // Central gap = 10-12% of canvas width (5-6% each side) - matching TARGET_REFERENCE
  const innerGapHalfWidth = halfWidth * (tier === 'mobile' ? 0.08 : 0.055);
  const outerExtentX      = halfWidth * 1.02;
  const horizontalSpan    = Math.max(outerExtentX - innerGapHalfWidth, 2.5);

  const heightBased  = viewportHeight * (tier === 'mobile' ? 0.26 : tier === 'tablet' ? 0.29 : 0.32);
  const spanBased    = horizontalSpan * 0.29;
  const verticalScale = Math.min(heightBased, spanBased, 3.4);

  const cycleScale   = tier === 'mobile' ? 0.88 : tier === 'tablet' ? 0.94 : 1.0;
  const densityScale = tier === 'mobile' ? 0.70 : tier === 'tablet' ? 0.86 : 1.0;

  return { tier, aspect, viewportWidth, viewportHeight,
           innerGapHalfWidth, outerExtentX, horizontalSpan,
           verticalScale, cycleScale, densityScale };
}

function gp(u, center, width) {
  const d = (u - center) / width;
  return Math.exp(-d * d);
}

/**
 * Evaluates the parametric ribbon surface at (u, v).
 * Returns { x, y, z, u, v, pinchProx, crestProx, edgeFade }
 *
 * DEF-10 fix: Sheet 0 uses low-frequency cosine (≈1.3 cycles across the span),
 * Sheet 1 uses higher-frequency sine (≈2.1 cycles), creating visually distinct
 * large-wave / inner-wave silhouettes matching TARGET_REFERENCE.
 */
function evalSurface(u, v, desc, layerCfg, sideCfg, layout) {
  const { sideSign, isRight } = sideCfg;
  const { zBaseOffset, verticalSpreadScale, phaseShift, layerIndex } = layerCfg;
  const {
    streamId, streamV, sLocal, strandPhase,
    freq2, ampMod, zPhase, zBias, reachMod, fadeEndU, terminalYOffset, accentProfile,
  } = desc;

  const uc = THREE.MathUtils.clamp(u, 0.0, 1.0);

  // ---- X (horizontal placement) -------------------------------------------
  const effSpan = layout.horizontalSpan * reachMod;
  // Clamp so no strand crosses into the central gap (DEF-07)
  const rawXMag = Math.max(layout.outerExtentX - uc * effSpan, layout.innerGapHalfWidth * 1.01);
  const x = sideSign * rawXMag;

  // ---- Envelopes ----------------------------------------------------------
  // Broad flare at outer edge, full-reach taper toward inner gap
  const outerFlare  = 1.0 + 0.42 * Math.exp(-uc * 1.9);
  const innerTaper  = 1.0 - 0.84 * Math.pow(THREE.MathUtils.smoothstep(uc, 0.60, 0.99), 1.4);
  const envelope    = outerFlare * innerTaper;
  const us          = uc * layout.cycleScale;
  const ph          = phaseShift * 0.22;

  let ySheet = 0.0;

  if (!isRight) {
    // ======================= LEFT FORMATION ==================================
    if (streamId === 0) {
      // Sheet 0 — smooth broad flowing wave (≈1.2 cycles) — distributed crests and troughs
      const top =
         0.68 * Math.cos(us * Math.PI * 1.15 + 0.10 + ph) * envelope
        + 0.18 * Math.cos(us * Math.PI * 2.45 - 0.25 + ph) * envelope
        + 0.12 * Math.exp(-uc * 2.5);
      const bot =
         0.48 * Math.cos(us * Math.PI * 1.10 + 0.75 + ph) * envelope
        - 0.16 * Math.cos(us * Math.PI * 2.30 + 0.40 + ph) * envelope
        - 0.14 * Math.exp(-uc * 2.2);
      ySheet = THREE.MathUtils.lerp(bot, top, streamV);

    } else if (streamId === 1) {
      // Sheet 1 — smooth counter-flow (≈1.8 cycles) — interwoven with Sheet 0
      const top =
         0.52 * Math.sin(us * Math.PI * 1.75 - 0.45 + ph) * envelope
        + 0.20 * Math.sin(us * Math.PI * 3.10 + 0.20 + ph) * envelope * innerTaper
        + 0.10 * Math.exp(-uc * 2.8);
      const bot =
        -0.58 * Math.exp(-uc * 1.85)
        + 0.32 * Math.sin(us * Math.PI * 1.65 - 0.85 + ph) * envelope
        + 0.14 * Math.sin(us * Math.PI * 2.95 - 0.50 + ph) * envelope * innerTaper;
      ySheet = THREE.MathUtils.lerp(bot, top, streamV);

    } else {
      // Sheet 2 — accent / canopy
      if (accentProfile === 1) {
        ySheet = (-0.52 * Math.exp(-uc * 1.95)
          - 0.28 * Math.cos(us * Math.PI * 1.55 + 0.60 + ph) * envelope) * innerTaper;
      } else if (accentProfile === 2) {
        ySheet = ( 0.38 * Math.exp(-uc * 2.1)
          + 0.24 * Math.sin(us * Math.PI * 1.70 - 0.30 + ph) * envelope) * innerTaper;
      } else {
        const cSign = sLocal >= 0 ? 1.0 : -1.0;
        ySheet = cSign * (0.95 * Math.exp(-uc * 1.65)
          + 0.22 * Math.cos(us * Math.PI * 1.40 + strandPhase) * envelope) * innerTaper;
      }
    }

  } else {
    // ======================= RIGHT FORMATION =================================
    if (streamId === 0) {
      // Sheet 0 — smooth broad flowing wave (≈1.2 cycles)
      const top =
         0.72 * Math.exp(-uc * 1.60)
        + 0.42 * Math.cos(us * Math.PI * 1.18 - 0.15 + ph) * envelope
        + 0.18 * Math.cos(us * Math.PI * 2.50 + 0.20 + ph) * envelope;
      const bot =
         0.15 * Math.exp(-uc * 2.0)
        + 0.38 * Math.cos(us * Math.PI * 1.12 + 0.60 + ph) * envelope
        - 0.16 * Math.cos(us * Math.PI * 2.35 - 0.30 + ph) * envelope;
      ySheet = THREE.MathUtils.lerp(bot, top, streamV);

    } else if (streamId === 1) {
      // Sheet 1 — smooth counter-flow (≈1.8 cycles)
      const top =
         0.48 * Math.sin(us * Math.PI * 1.78 - 0.25 + ph) * envelope
        + 0.22 * Math.sin(us * Math.PI * 3.15 - 0.10 + ph) * envelope * innerTaper
        + 0.08 * Math.exp(-uc * 2.5);
      const bot =
        -0.65 * Math.exp(-uc * 1.75)
        + 0.30 * Math.sin(us * Math.PI * 1.68 - 0.70 + ph) * envelope
        + 0.16 * Math.sin(us * Math.PI * 3.00 + 0.40 + ph) * envelope * innerTaper;
      ySheet = THREE.MathUtils.lerp(bot, top, streamV);

    } else {
      if (accentProfile === 1) {
        ySheet = (-0.68 * Math.exp(-uc * 1.72)
          - 0.26 * Math.cos(us * Math.PI * 1.58 - 0.50 + ph) * envelope) * innerTaper;
      } else if (accentProfile === 2) {
        ySheet = ( 0.42 * Math.exp(-uc * 2.2)
          + 0.28 * Math.sin(us * Math.PI * 1.75 + 0.25 + ph) * envelope) * innerTaper;
      } else {
        const cSign = sLocal >= 0 ? 1.0 : -1.0;
        ySheet = cSign * (1.00 * Math.exp(-uc * 1.58)
          + 0.24 * Math.cos(us * Math.PI * 1.42 + strandPhase) * envelope) * innerTaper;
      }
    }
  }

  // ---- Secondary ripple ---------------------------------------------------
  const ripple =
    Math.sin(us * Math.PI * (1.65 * freq2) + strandPhase) *
    (0.078 + 0.055 * (1.0 - uc * 0.5)) *
    innerTaper * ampMod;

  // ---- Inner fan-out distribution -----------------------------------------
  const dist =
    THREE.MathUtils.smoothstep(uc, 0.60, 0.98) *
    terminalYOffset *
    (1.0 - 0.22 * THREE.MathUtils.smoothstep(uc, 0.90, 1.0));

  const y = (ySheet + ripple + dist) * layout.verticalScale * verticalSpreadScale;

  // ---- Z depth (front-to-back sheet weaving) ------------------------------
  const depthSign = streamId === 0 ? 1.0 : streamId === 1 ? -1.0 : 0.5 * sLocal;
  const zWeave =
    (depthSign * 0.85 * Math.sin(uc * Math.PI * 1.6 + zPhase)
     + 0.44 * Math.cos(uc * Math.PI * 2.2 + strandPhase * 0.65)
     + sLocal * 0.50 + zBias) * innerTaper;
  const z = zBaseOffset + zWeave - layerIndex * 0.26 * uc;

  // ---- Proximity metrics --------------------------------------------------
  const nexusUs = isRight
    ? [0.18, 0.34, 0.50, 0.68]
    : [0.14, 0.34, 0.52, 0.68];
  const pinchProx = nexusUs.reduce((mx, nu) => Math.max(mx, gp(uc, nu, 0.09)), 0.0);
  const crestUs   = isRight
    ? [0.18, 0.50, 0.74]
    : [0.22, 0.52, 0.76];
  const crestProx = crestUs.reduce((mx, cu) => Math.max(mx, gp(uc, cu, 0.13)), 0.0);

  // ---- Edge fades ---------------------------------------------------------
  const outerFade   = THREE.MathUtils.smoothstep(uc, 0.0, 0.025);
  const fadeStart   = Math.max(0.72, fadeEndU - 0.22);
  const innerFade   = 1.0 - THREE.MathUtils.smoothstep(uc, fadeStart, fadeEndU);
  const edgeFade    = outerFade * Math.pow(innerFade, 1.1);

  return { x, y, z, u: uc, v, pinchProx, crestProx, edgeFade };
}

/**
 * Creates strand descriptors for one (layerIndex, isRight) combination.
 * Sheet 0: main large-wave strands
 * Sheet 1: counter-flow inner-wave strands
 * Sheet 2: accent (violet) + canopy boundary
 */
function makeStrandDescriptors(layerIndex, isRight, densityScale, rng) {
  const descs = [];

  const s0n = Math.max(5, Math.round((layerIndex === 0 ? 13 : layerIndex === 1 ? 9 : 6) * densityScale));
  const s1n = Math.max(5, Math.round((layerIndex === 0 ? 13 : layerIndex === 1 ? 9 : 6) * densityScale));
  const s2n = layerIndex === 0 ? 6 : layerIndex === 1 ? 4 : 4;

  const total = s0n + s1n + s2n;
  let gj = 0;

  const push = (streamId, count) => {
    for (let k = 0; k < count; k++) {
      const sv    = count > 1 ? k / (count - 1) : 0.5;
      const sLoc  = sv * 2.0 - 1.0;
      const gv    = total > 1 ? gj / (total - 1) : 0.5;

      let role = 'secondary';
      let isPrimary = false;
      let accentProfile = 0;
      let heroWeight = 0.0;
      let isBeadCanopy = false;

      if (streamId === 0) {
        const idxA = Math.round((count - 1) * (isRight ? 0.80 : 0.82));
        const idxB = Math.round((count - 1) * (isRight ? 0.50 : 0.50));
        const idxC = Math.round((count - 1) * 0.20);
        if (layerIndex <= 1 && (k === idxA || k === idxB || (layerIndex === 0 && k === idxC))) {
          role = 'primary'; isPrimary = true;
          heroWeight = k === idxA ? 1.0 : k === idxB ? 0.90 : 0.82;
        }
      } else if (streamId === 1) {
        const idxD = Math.round((count - 1) * (isRight ? 0.80 : 0.82));
        const idxE = Math.round((count - 1) * 0.22);
        if (layerIndex <= 1 && (k === idxD || (layerIndex === 0 && k === idxE))) {
          role = 'primary'; isPrimary = true;
          heroWeight = k === idxD ? 0.95 : 0.84;
        }
      } else {
        if (k === 0) {
          role = 'accent'; accentProfile = 1; isPrimary = layerIndex === 0; heroWeight = 0.92;
        } else if (k === 1) {
          role = 'accent'; accentProfile = 2; isPrimary = layerIndex === 0; heroWeight = 0.88;
        } else {
          role = 'canopy'; accentProfile = 3;
          isBeadCanopy = k === 2 || k === count - 1;
        }
      }

      const effSLocal = (streamId === 2 && k >= 2)
        ? (count > 3 ? (k - 2) / (count - 3) * 2.0 - 1.0 : (k === 2 ? 1.0 : -1.0))
        : sLoc;

      const basePhase =
        streamId === 0 ? (isRight ?  0.22 : -0.20)
        : streamId === 1 ? (isRight ? -0.52 :  0.46)
        : (isRight ? 0.60 : -0.50);

      const strandPhase   = basePhase + effSLocal * 0.60 + (rng() - 0.5) * 0.12;
      const freq2         = 0.90 + 0.18 * sv + (rng() - 0.5) * 0.06;
      const ampMod        = 0.88 + 0.24 * Math.sin(sv * Math.PI);
      const zPhase        = streamId * 1.06 + sv * 0.95 + (rng() - 0.5) * 0.18;
      const zBias         = (sv - 0.5) * 0.40 + (rng() - 0.5) * 0.14;

      const reachMod = isPrimary ? 0.98 + 0.02 * rng()
        : role === 'canopy' ? 0.88 + 0.10 * rng()
        : 0.92 + 0.07 * sv + 0.01 * rng();

      const fadeEndU = isPrimary ? 0.98 + 0.02 * rng()
        : role === 'canopy' ? 0.88 + 0.10 * rng()
        : 0.92 + 0.07 * sv + 0.01 * rng();

      const terminalYOffset =
        (streamId === 0 ? 0.05 : streamId === 1 ? -0.05 : 0.0)
        + effSLocal * 0.12 + (rng() - 0.5) * 0.04;

      descs.push({
        strandIndex: gj, streamId, streamIndex: k, streamCount: count,
        streamV: sv, sLocal: effSLocal, v: gv,
        role, accentProfile, isPrimary, isBeadCanopy, heroWeight,
        strandPhase, freq2, ampMod, zPhase, zBias,
        reachMod, fadeEndU, terminalYOffset,
      });
      gj++;
    }
  };

  push(0, s0n);
  push(1, s1n);
  push(2, s2n);
  return descs;
}

/**
 * Computes per-vertex color weights and alpha.
 *
 * DEF-02 fix: accent weight (wAccent) is only non-zero on 'accent' role strands
 * for filaments. For connection segments it is capped at 0.35 and only raised
 * in regions where the nearby filament is accent-typed.
 */
function vertexAppearance(pt, desc, layerIndex, wireType = 'filament', densityBoost = 0.0) {
  const { pinchProx, crestProx, edgeFade } = pt;
  const { role, accentProfile, isPrimary, heroWeight } = desc;

  let wPrimary = 0.0, wSecondary = 0.0, wAccent = 0.0, wHighlight = 0.0;
  let alpha = edgeFade;

  if (wireType === 'connection') {
    // Fine mesh connections — predominantly blue, accent capped (DEF-02)
    const violetZone = role === 'accent'
      ? 0.65
      : 0.30 * gp(pt.u, 0.62, 0.18) + 0.25 * gp(pt.u, 0.28, 0.16);

    if (layerIndex === 0) {
      wPrimary   = 0.30 + 0.22 * pinchProx + 0.12 * densityBoost;
      wSecondary = 0.90 - 0.10 * pinchProx;
      wAccent    = Math.min(violetZone, 0.35);   // hard cap (DEF-02)
      wHighlight = 0.14 * Math.pow(pinchProx, 1.6);
      alpha     *= 0.22 + 0.24 * pinchProx + 0.10 * crestProx + 0.08 * densityBoost;
    } else if (layerIndex === 1) {
      wPrimary   = 0.20 + 0.14 * pinchProx;
      wSecondary = 0.90;
      wAccent    = Math.min(violetZone * 0.85, 0.30);
      wHighlight = 0.06 * pinchProx;
      alpha     *= 0.16 + 0.14 * pinchProx;
    } else {
      wPrimary   = 0.15;
      wSecondary = 0.92;
      wAccent    = Math.min(violetZone * 0.6, 0.20);
      alpha     *= 0.12 + 0.08 * pinchProx;
    }

  } else {
    // Longitudinal filaments
    if (role === 'accent') {
      // Accent (violet) — only Sheet 2 strands
      const vw = accentProfile === 1
        ? gp(pt.u, 0.34, 0.26) + 0.92 * gp(pt.u, 0.64, 0.20)
        : gp(pt.u, 0.52, 0.22) + 0.84 * gp(pt.u, 0.22, 0.17);
      const vm = THREE.MathUtils.clamp(vw, 0.68, 1.0);
      wAccent    = 1.0 * vm;
      wPrimary   = 0.14 * (1.0 - vm * 0.6);
      wSecondary = 0.10 * (1.0 - vm * 0.5);
      wHighlight = 0.28 * Math.pow(Math.max(pinchProx, crestProx * 0.8), 1.5);
      alpha     *= isPrimary ? 0.86 : 0.52;

    } else if (isPrimary || role === 'primary') {
      // Primary cyan/ice-blue hero filaments — no accent color (DEF-02)
      wPrimary   = 1.00;
      wSecondary = 0.18;
      wAccent    = 0.0;   // strictly zero — primary strands must be pure cyan (DEF-02)
      wHighlight = THREE.MathUtils.clamp(
        0.58 * Math.pow(pinchProx, 1.3) + 0.32 * Math.pow(crestProx, 1.4),
        0.08, 0.90
      );
      alpha *= isPrimary ? 0.90 + 0.08 * heroWeight : 0.62;

    } else if (role === 'canopy') {
      wPrimary   = 0.34;
      wSecondary = 0.84;
      wAccent    = 0.28;
      wHighlight = 0.12 * pinchProx;
      alpha     *= 0.36;

    } else {
      // Secondary strands — blue-dominant, slight accent for every 4th strand (not 3rd) (DEF-02)
      const isFaintViolet = desc.streamIndex % 4 === 1;
      wPrimary   = isFaintViolet ? 0.22 : (layerIndex === 0 ? 0.48 + 0.18 * pinchProx : 0.34);
      wSecondary = isFaintViolet ? 0.60 : (layerIndex === 0 ? 0.84 : 0.90);
      wAccent    = isFaintViolet ? Math.min(0.55 * Math.sin(pt.u * Math.PI), 0.30) : 0.0;
      wHighlight = layerIndex === 0 ? 0.14 * Math.pow(pinchProx, 1.6) : 0.05 * pinchProx;
      alpha     *= layerIndex === 0 ? 0.38 + 0.22 * pinchProx : layerIndex === 1 ? 0.28 : 0.18;
    }
  }

  return { weights: [wPrimary, wSecondary, wAccent, wHighlight],
           alpha: THREE.MathUtils.clamp(alpha, 0.0, 1.0) };
}

function pushSegment(buf, vA, vB, appA, appB) {
  buf.positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
  buf.basePositions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
  buf.colorWeights.push(...appA.weights, ...appB.weights);
  buf.alphas.push(appA.alpha, appB.alpha);
  buf.uvParams.push(vA.u, vA.v ?? 0, vB.u, vB.v ?? 0);
  buf.metas.push(
    vA.sideSign  ?? 0, vA.layerIndex ?? 0, vA.strandIndex ?? 0, vA.pinchProx ?? 0,
    vB.sideSign  ?? 0, vB.layerIndex ?? 0, vB.strandIndex ?? 0, vB.pinchProx ?? 0
  );
}

function pushNode(nd, v, weights, alpha, size, tier) {
  nd.positions.push(v.x, v.y, v.z);
  nd.basePositions.push(v.x, v.y, v.z);
  nd.colorWeights.push(...weights);
  nd.alphas.push(alpha);
  nd.sizes.push(size);
  nd.tiers.push(tier);
  nd.uvParams.push(v.u ?? 0, v.v ?? 0);
  nd.metas.push(v.sideSign ?? 0, v.layerIndex ?? 0, v.strandIndex ?? 0, v.pinchProx ?? 0);
}

function buildLineGeo(buf) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',      new THREE.Float32BufferAttribute(buf.positions, 3));
  geo.setAttribute('aBasePosition', new THREE.Float32BufferAttribute(buf.basePositions, 3));
  geo.setAttribute('aColorWeights', new THREE.Float32BufferAttribute(buf.colorWeights, 4));
  geo.setAttribute('aAlpha',        new THREE.Float32BufferAttribute(buf.alphas, 1));
  geo.setAttribute('aUvParam',      new THREE.Float32BufferAttribute(buf.uvParams, 2));
  geo.setAttribute('aMeta',         new THREE.Float32BufferAttribute(buf.metas, 4));
  geo.computeBoundingSphere();
  return geo;
}

function emptyBuf() {
  return { positions: [], basePositions: [], colorWeights: [], alphas: [], uvParams: [], metas: [] };
}

export class NeuralGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.adjacency = new Map();
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, new Set());
    }
    return node;
  }

  hasEdge(idA, idB) {
    const adj = this.adjacency.get(idA);
    return adj ? adj.has(idB) : false;
  }

  addEdge(nodeA, nodeB, edgeType = 'secondary', extra = {}) {
    if (!nodeA || !nodeB || nodeA.id === nodeB.id) return null;
    if (this.hasEdge(nodeA.id, nodeB.id)) return null;

    const edge = {
      id: `e_${nodeA.id}_${nodeB.id}`,
      nodeA,
      nodeB,
      edgeType,
      layerIndex: extra.layerIndex ?? nodeA.layerIndex ?? 0,
      ...extra,
    };
    this.edges.push(edge);
    this.adjacency.get(nodeA.id).add(nodeB.id);
    this.adjacency.get(nodeB.id).add(nodeA.id);
    nodeA.degree = (nodeA.degree || 0) + 1;
    nodeB.degree = (nodeB.degree || 0) + 1;
    nodeA.neighbors.push(nodeB.id);
    nodeB.neighbors.push(nodeA.id);
    nodeA.edges.push(edge.id);
    nodeB.edges.push(edge.id);
    return edge;
  }
}

function segmentsCross2D(p1, p2, p3, p4) {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;

  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-6) return false;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const s = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

  return t > 0.06 && t < 0.94 && s > 0.06 && s < 0.94;
}

export function generateNeuralWireGeometry(layout) {
  const layerCfgs = [
    { layerIndex: 0, numU: Math.round(54 * layout.densityScale), subSteps: 3,
      zBaseOffset: 0.25,  verticalSpreadScale: 1.00, phaseShift: 0.00 },
    { layerIndex: 1, numU: Math.round(42 * layout.densityScale), subSteps: 2,
      zBaseOffset: -1.45, verticalSpreadScale: 1.14, phaseShift: 0.76 },
    { layerIndex: 2, numU: Math.round(30 * layout.densityScale), subSteps: 2,
      zBaseOffset: -3.10, verticalSpreadScale: 1.28, phaseShift: -1.02 },
  ];

  const primaryBuf  = emptyBuf();
  const filamentBuf = emptyBuf();
  const meshBuf     = emptyBuf();
  const deepBuf     = emptyBuf();

  const nodeData = {
    positions: [], basePositions: [], colorWeights: [],
    alphas: [], sizes: [], tiers: [], uvParams: [], metas: [],
  };

  const canonicalVertices = [];
  const graph = new NeuralGraph();

  const sides = [
    { side: 'left',  sideSign: -1, isRight: false, seed: 20260501 },
    { side: 'right', sideSign:  1, isRight: true,  seed: 20260917 },
  ];

  sides.forEach((sideCfg) => {
    const rng = createSeededRandom(sideCfg.seed);

    layerCfgs.forEach((layerCfg) => {
      const { layerIndex, numU, subSteps } = layerCfg;

      const descs = makeStrandDescriptors(layerIndex, sideCfg.isRight, layout.densityScale, rng);
      const numV  = descs.length;

      // 1. Build canonical vertex grid & nodes
      const layerNodes = [];
      const grid = Array.from({ length: numU }, () => new Array(numV));

      for (let i = 0; i < numU; i++) {
        const uLin = i / (numU - 1);
        const uWarp = uLin - 0.016 * Math.sin(uLin * Math.PI * 2.4 + (sideCfg.isRight ? 0.33 : -0.23));

        for (let j = 0; j < numV; j++) {
          const desc = descs[j];
          const stagger = ((j % 2) - 0.5) * 0.38 + (rng() - 0.5) * 0.24;
          const uEff = i > 0 && i < numU - 1
            ? THREE.MathUtils.clamp(uWarp + stagger / (numU - 1), 0.002, 0.998)
            : THREE.MathUtils.clamp(uLin, 0.0, 1.0);

          const pt = evalSurface(uEff, desc.v, desc, layerCfg, sideCfg, layout);
          const nodeId = `n_${sideCfg.side}_L${layerIndex}_u${i}_v${j}`;
          const vr = {
            ...pt,
            id: nodeId,
            uIndex: i, vIndex: j, strandIndex: j,
            layerIndex, sideSign: sideCfg.sideSign,
            isRight: sideCfg.isRight,
            streamId: desc.streamId,
            descriptor: desc,
            degree: 0,
            heroJunction: desc.isPrimary ? 1 : 0,
            tier: 0,
            size: 0.16 + 0.06 * rng(),
            alpha: pt.edgeFade * (0.80 + 0.16 * rng()),
            colorWeights: [0.80, 0.20, 0.0, 0.1],
            neighbors: [],
            edges: [],
          };
          grid[i][j] = vr;
          graph.addNode(vr);
          layerNodes.push(vr);
        }
      }

      // Spatial search bins along u
      const numBins = 36;
      const bins = Array.from({ length: numBins }, () => []);
      for (const node of layerNodes) {
        const bIdx = THREE.MathUtils.clamp(Math.floor(node.u * numBins), 0, numBins - 1);
        bins[bIdx].push(node);
      }

      const edgeBins = Array.from({ length: numBins }, () => []);

      function registerEdge(edge) {
        if (!edge) return;
        const minU = Math.min(edge.nodeA.u, edge.nodeB.u);
        const maxU = Math.max(edge.nodeA.u, edge.nodeB.u);
        const b0 = THREE.MathUtils.clamp(Math.floor(minU * numBins), 0, numBins - 1);
        const b1 = THREE.MathUtils.clamp(Math.floor(maxU * numBins), 0, numBins - 1);
        for (let b = b0; b <= b1; b++) {
          edgeBins[b].push(edge);
        }
      }

      // 2. Primary Hero Pathways (curvilinear continuous axon flow via Catmull-Rom)
      for (let j = 0; j < numV; j++) {
        const desc = descs[j];
        if (!desc.isPrimary || layerIndex > 1) continue;

        const ctrlPts = [];
        for (let i = 0; i < numU; i++) {
          const gv = grid[i][j];
          ctrlPts.push(new THREE.Vector3(gv.x, gv.y, gv.z));
        }

        const curve = new THREE.CatmullRomCurve3(ctrlPts, false, 'centripetal', 0.5);
        const nSamples = (numU - 1) * subSteps;
        let prevV = null, prevApp = null;

        for (let s = 0; s <= nSamples; s++) {
          const exactI = s % subSteps === 0 ? s / subSteps : -1;
          let sv;

          if (exactI >= 0 && exactI < numU) {
            sv = grid[exactI][j];
            if (exactI > 0) {
              const prevNode = grid[exactI - 1][j];
              const edge = graph.addEdge(prevNode, sv, 'primary', { layerIndex });
              registerEdge(edge);
            }
          } else {
            const t = s / nSamples;
            const pt = curve.getPoint(t);
            const iF = Math.floor(t * (numU - 1));
            const iC = Math.min(numU - 1, iF + 1);
            const fr = t * (numU - 1) - iF;
            const v0 = grid[iF][j];
            const v1 = grid[iC][j];
            const uI = THREE.MathUtils.lerp(v0.u, v1.u, fr);
            const sm = evalSurface(uI, desc.v, desc, layerCfg, sideCfg, layout);
            sv = {
              x: pt.x, y: pt.y, z: pt.z, u: uI, v: desc.v,
              pinchProx: sm.pinchProx, crestProx: sm.crestProx, edgeFade: sm.edgeFade,
              sideSign: sideCfg.sideSign, layerIndex, strandIndex: j,
            };
          }

          const app = vertexAppearance(sv, desc, layerIndex, 'filament');
          if (prevV) {
            pushSegment(primaryBuf, prevV, sv, prevApp, app);
          }
          prevV = sv;
          prevApp = app;
        }
      }

      // 3. Secondary Flow & Branching Connections (smooth Catmull-Rom curves)
      for (let j = 0; j < numV; j++) {
        const desc = descs[j];
        if (desc.isPrimary && layerIndex <= 1) continue;

        const filBuf = layerIndex === 2 ? deepBuf : filamentBuf;

        // Draw smooth secondary flow curves
        const ctrlPts = [];
        for (let i = 0; i < numU; i++) {
          const gv = grid[i][j];
          ctrlPts.push(new THREE.Vector3(gv.x, gv.y, gv.z));
        }

        const curve = new THREE.CatmullRomCurve3(ctrlPts, false, 'centripetal', 0.5);
        const secSubSteps = layerIndex === 0 ? 2 : 1;
        const nSamples = (numU - 1) * secSubSteps;
        let prevV = null, prevApp = null;

        for (let s = 0; s <= nSamples; s++) {
          const exactI = s % secSubSteps === 0 ? s / secSubSteps : -1;
          let sv;

          if (exactI >= 0 && exactI < numU) {
            sv = grid[exactI][j];
            if (exactI > 0 && rng() < 0.88) {
              const prevNode = grid[exactI - 1][j];
              const edgeType = desc.role === 'accent' ? 'accent' : 'secondary';
              const edge = graph.addEdge(prevNode, sv, edgeType, { layerIndex });
              registerEdge(edge);
            }
          } else {
            const t = s / nSamples;
            const pt = curve.getPoint(t);
            const iF = Math.floor(t * (numU - 1));
            const iC = Math.min(numU - 1, iF + 1);
            const fr = t * (numU - 1) - iF;
            const v0 = grid[iF][j];
            const v1 = grid[iC][j];
            const uI = THREE.MathUtils.lerp(v0.u, v1.u, fr);
            const sm = evalSurface(uI, desc.v, desc, layerCfg, sideCfg, layout);
            sv = {
              x: pt.x, y: pt.y, z: pt.z, u: uI, v: desc.v,
              pinchProx: sm.pinchProx, crestProx: sm.crestProx, edgeFade: sm.edgeFade,
              sideSign: sideCfg.sideSign, layerIndex, strandIndex: j,
            };
          }

          const app = vertexAppearance(sv, desc, layerIndex, 'filament');
          if (prevV && sv.edgeFade > 0.02) {
            pushSegment(filBuf, prevV, sv, prevApp, app);
          }
          prevV = sv;
          prevApp = app;
        }

        // Branching tendril connections to adjacent lanes
        for (let i = 0; i < numU - 1; i++) {
          const vA = grid[i][j];
          if (!vA || vA.edgeFade <= 0.04) continue;

          if (rng() < 0.28) {
            const targetJ = j + (rng() < 0.5 ? 1 : -1);
            if (targetJ >= 0 && targetJ < numV) {
              const vTarget = grid[i + 1][targetJ];
              if (vTarget && vTarget.descriptor.streamId === desc.streamId && vTarget.edgeFade > 0.04) {
                const edge = graph.addEdge(vA, vTarget, 'secondary', { layerIndex });
                if (edge) {
                  registerEdge(edge);
                  const aA = vertexAppearance(vA, desc, layerIndex, 'filament');
                  const aB = vertexAppearance(vTarget, vTarget.descriptor, layerIndex, 'filament');
                  pushSegment(filBuf, vA, vTarget, aA, aB);
                }
              }
            }
          }
        }
      }

      // 4. Irregular Triangulation & Polygonal Cells (Non-Crossing Spatial Graph)
      // Tightened distance envelope: ensures small and medium cells, avoids large empty triangles
      const connBuf = layerIndex === 2 ? deepBuf : meshBuf;
      const minEdgeDist = 0.045 * layout.verticalScale;
      const maxSlope    = 1.35;

      function canConnect2D(nA, nB) {
        const minU = Math.min(nA.u, nB.u);
        const maxU = Math.max(nA.u, nB.u);
        const b0 = THREE.MathUtils.clamp(Math.floor(minU * numBins), 0, numBins - 1);
        const b1 = THREE.MathUtils.clamp(Math.floor(maxU * numBins), 0, numBins - 1);

        for (let b = b0; b <= b1; b++) {
          for (const existingEdge of edgeBins[b]) {
            const eA = existingEdge.nodeA;
            const eB = existingEdge.nodeB;
            if (eA.id === nA.id || eA.id === nB.id || eB.id === nA.id || eB.id === nB.id) continue;
            if (segmentsCross2D(nA, nB, eA, eB)) {
              return false;
            }
          }
        }
        return true;
      }

      function addGraphConnection(vA, vB, edgeType = 'mesh', dBoost = 0.0) {
        if (!vA || !vB || vA.id === vB.id) return false;
        if (graph.hasEdge(vA.id, vB.id)) return false;

        const dx = Math.abs(vA.x - vB.x);
        const dy = Math.abs(vA.y - vB.y);
        const dz = Math.abs(vA.z - vB.z);
        const dist = Math.hypot(dx, dy, dz * 0.45);

        // Dynamic distance envelope: prevents large triangles at outer boundary
        const flareEnv = 1.0 - 0.42 * Math.exp(-vA.u * 2.2);
        const maxEdgeDist = (layerIndex === 0 ? 0.78 : layerIndex === 1 ? 0.95 : 1.15) * layout.verticalScale * flareEnv;

        if (dx < 0.03 || dy / (dx + 0.001) > maxSlope || dist > maxEdgeDist || dist < minEdgeDist) {
          return false;
        }

        if (!canConnect2D(vA, vB)) return false;

        const edge = graph.addEdge(vA, vB, edgeType, { layerIndex });
        if (edge) {
          registerEdge(edge);
          vA.heroJunction = (vA.heroJunction || 0) + (vB.descriptor?.isPrimary ? 1 : 0);
          vB.heroJunction = (vB.heroJunction || 0) + (vA.descriptor?.isPrimary ? 1 : 0);
          const aA = vertexAppearance(vA, vA.descriptor, layerIndex, 'connection', dBoost);
          const aB = vertexAppearance(vB, vB.descriptor, layerIndex, 'connection', dBoost);
          pushSegment(connBuf, vA, vB, aA, aB);
          return true;
        }
        return false;
      }

      const cellDensityAt = (u, v, pp) => {
        const uPeak = sideCfg.isRight ? 0.42 : 0.44;
        const chamberBoost = gp(u, uPeak, 0.28) * 0.55 + gp(u, uPeak + 0.30, 0.22) * 0.38;
        const pinchBoost   = pp * 0.45;
        const noise        = 0.5 + 0.3 * Math.sin(u * 11.3 + v * 7.1) + 0.2 * Math.cos(u * 7.7 - v * 5.3);
        return THREE.MathUtils.clamp(0.44 + chamberBoost + pinchBoost + noise * 0.18, 0.30, 1.0);
      };

      // Intra-sheet & cross-lane organic triangulation
      for (const nodeA of layerNodes) {
        if (nodeA.edgeFade <= 0.04) continue;
        const cd = cellDensityAt(nodeA.u, nodeA.v, nodeA.pinchProx);
        const bIdx = THREE.MathUtils.clamp(Math.floor(nodeA.u * numBins), 0, numBins - 1);
        const minB = Math.max(0, bIdx - 2);
        const maxB = Math.min(numBins - 1, bIdx + 3);

        const candidates = [];
        const flareEnv = 1.0 - 0.42 * Math.exp(-nodeA.u * 2.2);
        const maxDistA = (layerIndex === 0 ? 0.78 : layerIndex === 1 ? 0.95 : 1.15) * layout.verticalScale * flareEnv;

        for (let b = minB; b <= maxB; b++) {
          for (const nodeB of bins[b]) {
            if (nodeB.id === nodeA.id) continue;
            if (nodeB.u < nodeA.u - 0.001) continue;
            if (nodeB.edgeFade <= 0.04) continue;
            if (graph.hasEdge(nodeA.id, nodeB.id)) continue;

            const dist = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y, (nodeA.z - nodeB.z) * 0.45);
            if (dist <= maxDistA && dist >= minEdgeDist) {
              candidates.push({ node: nodeB, dist });
            }
          }
        }

        candidates.sort((a, b) => a.dist - b.dist);

        const maxNew = layerIndex === 0 ? 3 : 2;
        let added = 0;
        for (const cand of candidates) {
          if (added >= maxNew) break;
          if (nodeA.degree >= (nodeA.descriptor?.isPrimary ? 8 : 5)) break;
          if (cand.node.degree >= 6) continue;

          const prob = cd * (layerIndex === 0 ? 0.75 : layerIndex === 1 ? 0.55 : 0.35);
          if (rng() > prob) continue;

          const edgeType = (nodeA.descriptor?.role === 'accent' && cand.node.descriptor?.role === 'accent')
            ? 'accent' : 'mesh';

          if (addGraphConnection(nodeA, cand.node, edgeType, cd * 0.5)) {
            added++;
            // Triangle closure
            for (const neighborId of nodeA.neighbors) {
              const mutual = graph.nodes.get(neighborId);
              if (mutual && mutual.id !== cand.node.id && !graph.hasEdge(mutual.id, cand.node.id)) {
                const distM = Math.hypot(mutual.x - cand.node.x, mutual.y - cand.node.y, (mutual.z - cand.node.z) * 0.45);
                if (distM <= maxDistA && distM >= minEdgeDist && rng() < 0.60 * cd) {
                  addGraphConnection(mutual, cand.node, 'mesh', cd * 0.4);
                }
              }
            }
          }
        }
      }

      // 5. Inter-Sheet 3D Proximity Bridges (between Stream 0 and Stream 1)
      const bridgeMax = 0.58 * layout.verticalScale;
      for (const nodeA of layerNodes) {
        if (nodeA.edgeFade <= 0.04 || nodeA.streamId !== 0) continue;
        const bIdx = THREE.MathUtils.clamp(Math.floor(nodeA.u * numBins), 0, numBins - 1);

        for (let b = Math.max(0, bIdx - 1); b <= Math.min(numBins - 1, bIdx + 2); b++) {
          for (const nodeB of bins[b]) {
            if (nodeB.streamId !== 1 || nodeB.edgeFade <= 0.04) continue;
            const dist3 = Math.hypot(
              Math.abs(nodeA.x - nodeB.x),
              Math.abs(nodeA.y - nodeB.y),
              Math.abs(nodeA.z - nodeB.z) * 0.5
            );
            if (dist3 <= bridgeMax && Math.abs(nodeA.y - nodeB.y) / (Math.abs(nodeA.x - nodeB.x) + 0.001) <= 1.15) {
              if (rng() < 0.55 + 0.28 * nodeA.pinchProx) {
                addGraphConnection(nodeA, nodeB, 'mesh', 0.60);
              }
            }
          }
        }
      }

      // 6. Guarantee No Isolated Nodes: every node has degree >= 1
      for (const node of layerNodes) {
        if (node.degree === 0 && node.edgeFade > 0.04) {
          const bIdx = THREE.MathUtils.clamp(Math.floor(node.u * numBins), 0, numBins - 1);
          let best = null, bestDist = Infinity;
          for (let b = Math.max(0, bIdx - 2); b <= Math.min(numBins - 1, bIdx + 2); b++) {
            for (const nb of bins[b]) {
              if (nb.id === node.id || nb.edgeFade <= 0.04) continue;
              const dist = Math.hypot(node.x - nb.x, node.y - nb.y, (node.z - nb.z) * 0.45);
              if (dist < bestDist && dist > minEdgeDist) {
                bestDist = dist;
                best = nb;
              }
            }
          }
          if (best) {
            addGraphConnection(node, best, 'mesh');
          }
        }
      }

      // 7. Node Hierarchy Classification (Hub Nexus, Medium, Small, Bokeh)
      // Tier 2: Highlight nexus nodes (4 per side on Layer 0)
      if (layerIndex === 0) {
        const nexusUs = sideCfg.isRight ? [0.18, 0.34, 0.50, 0.68] : [0.14, 0.34, 0.52, 0.68];
        const nexusSizes = [0.88, 0.92, 0.80, 0.68];

        nexusUs.forEach((uT, ni) => {
          let best = null, bestScore = Infinity;
          for (const node of layerNodes) {
            const d = node.descriptor;
            const sc = Math.abs(node.u - uT)
              + Math.abs(d.streamV - 0.5) * 0.30
              - Math.min(node.degree, 6) * 0.04
              - (d.isPrimary ? 0.06 : 0.0);
            if (sc < bestScore) {
              bestScore = sc;
              best = node;
            }
          }

          if (best) {
            best.tier = 2;
            best.size = nexusSizes[ni];
            const isAccentNexus = ni >= 2 && best.descriptor.role === 'accent';
            best.colorWeights = [isAccentNexus ? 0.20 : 0.92, 0.12, isAccentNexus ? 0.85 : 0.08, 1.00];
            best.alpha = 0.96 - ni * 0.04;
          }
        });
      }

      // Medium, Small, and Bokeh nodes
      for (const node of layerNodes) {
        if (node.edgeFade <= 0.03 || node.degree === 0) continue;

        if (node.tier === 2) {
          pushNode(nodeData, node, node.colorWeights, node.alpha, node.size, node.tier);
          canonicalVertices.push(node);
          continue;
        }

        if (layerIndex === 2 && rng() < 0.22) {
          node.tier = 3;
          node.size = 0.44 + 0.48 * rng();
          node.colorWeights = [0.40, 0.65, 0.28, 0.06];
          node.alpha = node.edgeFade * (0.38 + 0.24 * rng());
          pushNode(nodeData, node, node.colorWeights, node.alpha, node.size, node.tier);
          canonicalVertices.push(node);
          continue;
        }

        if (node.descriptor.isBeadCanopy && layerIndex === 0 && node.uIndex % 2 === 0 && node.u < 0.76) {
          node.tier = node.uIndex % 6 === 0 ? 1 : 0;
          node.size = 0.17 + 0.07 * rng();
          node.colorWeights = [0.82, 0.22, 0.18, 0.50];
          node.alpha = node.edgeFade * (0.82 + 0.12 * rng());
          pushNode(nodeData, node, node.colorWeights, node.alpha, node.size, node.tier);
          canonicalVertices.push(node);
          continue;
        }

        const isMedium =
          (layerIndex === 0 && node.degree >= 4 && (node.heroJunction >= 1 || rng() < 0.42))
          || (layerIndex === 0 && node.descriptor.isPrimary && node.degree >= 3 && (node.pinchProx > 0.32 || node.crestProx > 0.34))
          || (layerIndex === 1 && node.degree >= 4 && rng() < 0.35);

        if (isMedium) {
          node.tier = 1;
          const aM = node.descriptor.role === 'accent' ? 0.80 : 0.14 + 0.22 * rng();
          node.size = 0.25 + 0.10 * rng() + 0.014 * Math.min(node.degree, 6);
          node.alpha = node.edgeFade * (0.88 + 0.12 * rng());
          node.colorWeights = [0.88, 0.14, aM, 0.70];
          pushNode(nodeData, node, node.colorWeights, node.alpha, node.size, node.tier);
          canonicalVertices.push(node);
        } else {
          const smallP = layerIndex === 0 ? Math.min(0.88, 0.48 + 0.08 * node.degree + 0.18 * node.pinchProx)
            : layerIndex === 1 ? Math.min(0.68, 0.32 + 0.06 * node.degree) : 0.28;

          if (rng() < smallP) {
            node.tier = 0;
            const app = vertexAppearance(node, node.descriptor, layerIndex, 'filament');
            node.size = 0.15 + 0.06 * rng();
            node.alpha = node.edgeFade * (0.80 + 0.16 * rng());
            node.colorWeights = [Math.max(0.74, app.weights[0]), app.weights[1] * 0.4, app.weights[2] * 0.5, 0.38 + 0.24 * node.pinchProx];
            pushNode(nodeData, node, node.colorWeights, node.alpha, node.size, node.tier);
            canonicalVertices.push(node);
          }
        }
      }
    });
  });

  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position',      new THREE.Float32BufferAttribute(nodeData.positions, 3));
  nodeGeo.setAttribute('aBasePosition', new THREE.Float32BufferAttribute(nodeData.basePositions, 3));
  nodeGeo.setAttribute('aColorWeights', new THREE.Float32BufferAttribute(nodeData.colorWeights, 4));
  nodeGeo.setAttribute('aAlpha',        new THREE.Float32BufferAttribute(nodeData.alphas, 1));
  nodeGeo.setAttribute('aNodeSize',     new THREE.Float32BufferAttribute(nodeData.sizes, 1));
  nodeGeo.setAttribute('aNodeTier',     new THREE.Float32BufferAttribute(nodeData.tiers, 1));
  nodeGeo.setAttribute('aUvParam',      new THREE.Float32BufferAttribute(nodeData.uvParams, 2));
  nodeGeo.setAttribute('aMeta',         new THREE.Float32BufferAttribute(nodeData.metas, 4));
  nodeGeo.computeBoundingSphere();

  return {
    primaryGeo:   buildLineGeo(primaryBuf),
    filamentGeo:  buildLineGeo(filamentBuf),
    meshGeo:      buildLineGeo(meshBuf),
    deepGeo:      buildLineGeo(deepBuf),
    nodeGeo,
    canonicalVertices,
    graph,
  };
}

/* ============================================================================
 * MODULE 4 — PARTICLES
 * Dense batched Points field concentrated around wire formations.
 * ========================================================================== */

export function generateNeuralWireParticles(canonicalVertices, layout) {
  const rng   = createSeededRandom(9021088);
  const total = Math.round(11200 * layout.densityScale);

  const positions    = new Float32Array(total * 3);
  const basePos      = new Float32Array(total * 3);
  const colorWeights = new Float32Array(total * 4);
  const alphas       = new Float32Array(total);
  const sizes        = new Float32Array(total);
  const uvParams     = new Float32Array(total * 2);

  const activeMesh = canonicalVertices.filter(
    (v) => v.u >= 0.01 && v.u <= 0.96 && v.edgeFade > 0.06
  );
  const richMesh   = activeMesh.filter(
    (v) => v.layerIndex <= 1 && (v.degree >= 2 || v.descriptor.isPrimary)
  );

  const pool0 = richMesh.length  > 0 ? richMesh  : activeMesh;
  const pool1 = activeMesh.length > 0 ? activeMesh : canonicalVertices;

  for (let i = 0; i < total; i++) {
    const roll   = rng();
    const pool   = roll < 0.60 ? pool0 : pool1;
    const anchor = pool[Math.floor(rng() * pool.length)];

    let px = anchor.x, py = anchor.y, pz = anchor.z;
    let alpha = 0.52, size = 0.050;
    let wP = 0.80, wS = 0.34, wA = anchor.descriptor.role === 'accent' ? 0.60 : 0.14 * rng(), wH = 0.08;

    if (roll < 0.58) {
      // Zone 1 (58%) — micro-dust around wires
      const ang = rng() * Math.PI * 2.0;
      const rad = 0.04 + 0.40 * Math.pow(rng(), 1.5);
      px += Math.cos(ang) * rad * 1.15;
      py += Math.sin(ang) * rad * 0.28 * layout.verticalScale;
      pz += (rng() - 0.5) * 0.35;
      size  = 0.038 + 0.050 * Math.pow(rng(), 1.9);
      alpha = (0.38 + 0.36 * rng()) * Math.pow(anchor.edgeFade, 0.88);
      if (rng() < 0.14) { wH = 0.52 + 0.34 * rng(); alpha = Math.min(0.84, alpha * 1.18); }
    } else if (roll < 0.86) {
      // Zone 2 (28%) — depth-layer suspended particles
      px += (rng() - 0.5) * 0.88;
      py += (rng() - 0.5) * 0.40 * layout.verticalScale;
      pz -= 0.14 + rng() * 2.70;
      size  = 0.036 + 0.044 * Math.pow(rng(), 1.85);
      alpha = (0.28 + 0.32 * rng()) * Math.pow(anchor.edgeFade, 0.90);
      wS = 0.56; wA = Math.max(wA, 0.26 * rng());
    } else if (roll < 0.96) {
      // Zone 3 (10%) — canopy trail spores
      const dY = anchor.y >= 0 ? 1.0 : -1.0;
      px += (rng() - 0.5) * 1.05;
      py += dY * (0.08 + 0.34 * Math.pow(rng(), 1.5)) * layout.verticalScale;
      pz -= 0.20 + rng() * 2.8;
      size  = 0.034 + 0.040 * rng();
      alpha = (0.22 + 0.26 * rng()) * Math.pow(anchor.edgeFade, 0.86);
      wS = 0.62; wA = 0.28;
    } else {
      // Zone 4 (4%) — sparse background
      const ss  = rng() < 0.5 ? -1.0 : 1.0;
      const minX = layout.innerGapHalfWidth * 1.20;
      px = ss * (minX + Math.pow(rng(), 0.72) * (layout.outerExtentX - minX));
      py = (rng() - 0.5) * layout.verticalScale * 1.60;
      pz = -1.0 - rng() * 3.4;
      size  = 0.036 + 0.044 * Math.pow(rng(), 2.1);
      alpha = 0.14 + 0.20 * rng();
      wS = 0.80;
    }

    // Hard-clamp particles out of central gap
    const minAbsX = layout.innerGapHalfWidth * 1.01;
    if (Math.abs(px) < minAbsX) {
      px = Math.sign(px || 1) * minAbsX;
    }

    const i3 = i * 3, i4 = i * 4, i2 = i * 2;
    positions[i3]   = px; positions[i3+1] = py; positions[i3+2] = pz;
    basePos[i3]     = px; basePos[i3+1]   = py; basePos[i3+2]   = pz;
    colorWeights[i4] = wP; colorWeights[i4+1] = wS; colorWeights[i4+2] = wA; colorWeights[i4+3] = wH;
    alphas[i] = alpha;
    sizes[i]  = size;
    uvParams[i2] = anchor.u; uvParams[i2+1] = anchor.v ?? 0;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',      new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aBasePosition', new THREE.BufferAttribute(basePos, 3));
  geo.setAttribute('aColorWeights', new THREE.BufferAttribute(colorWeights, 4));
  geo.setAttribute('aAlpha',        new THREE.BufferAttribute(alphas, 1));
  geo.setAttribute('aParticleSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aUvParam',      new THREE.BufferAttribute(uvParams, 2));
  geo.computeBoundingSphere();
  return geo;
}

export function computeFrustumDimensions(pixelW, pixelH, fovDeg = 34, cameraZ = 16) {
  const w   = Math.max(pixelW || 1425, 1);
  const h   = Math.max(pixelH || 500,  1);
  const asp = w / h;
  const vH  = 2.0 * Math.tan(THREE.MathUtils.degToRad(fovDeg) * 0.5) * cameraZ;
  return { viewportWidth: vH * asp, viewportHeight: vH, aspect: asp };
}

/* ============================================================================
 * MODULE 5 — NeuralWireField (R3F scene component)
 * Mountable inside any existing Canvas.
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
    width:  typeof window !== 'undefined' ? window.innerWidth                      : 1425,
    height: typeof window !== 'undefined' ? Math.round(window.innerWidth / 3.0)   : 475,
    dpr:    typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setWindowSize({
      width:  window.innerWidth,
      height: window.innerHeight,
      dpr:    Math.min(window.devicePixelRatio || 1, 2),
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const frustum = useMemo(
    () => computeFrustumDimensions(windowSize.width, windowSize.height, 34, 16),
    [windowSize.width, windowSize.height]
  );

  const vpW = viewportWidth  ?? frustum.viewportWidth;
  const vpH = viewportHeight ?? frustum.viewportHeight;
  const dpr = pixelRatio     ?? windowSize.dpr;

  const layout = useMemo(
    () => computeResponsiveLayout(Math.round(vpW * 2) / 2, Math.round(vpH * 2) / 2),
    [vpW, vpH]
  );

  const { primaryGeo, filamentGeo, meshGeo, deepGeo, nodeGeo, particleGeo } = useMemo(() => {
    const wg = generateNeuralWireGeometry(layout);
    const pg = generateNeuralWireParticles(wg.canonicalVertices, layout);
    return { ...wg, particleGeo: pg };
  }, [layout]);

  const resolvedTheme = useMemo(() => resolveNeuralWireTheme(theme), [theme]);

  const materials = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => createNeuralWireMaterials(resolvedTheme, dpr), []
  );

  useEffect(() => {
    updateNeuralWireMaterials(materials, resolvedTheme, dpr);
  }, [materials, resolvedTheme, dpr]);

  // Phase 2: Animation loop — update time uniforms
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    
    // Update all wire materials
    ['primaryMat', 'layer0Mat', 'layer1Mat', 'layer2Mat'].forEach((k) => {
      const m = materials[k];
      if (m && m.uniforms.uTime) {
        m.uniforms.uTime.value = t;
      }
    });
    
    // Update node material
    if (materials.nodeMaterial && materials.nodeMaterial.uniforms.uTime) {
      materials.nodeMaterial.uniforms.uTime.value = t;
    }
  });

  useEffect(() => {
    return () => {
      [primaryGeo, filamentGeo, meshGeo, deepGeo, nodeGeo, particleGeo]
        .forEach((g) => g && g.dispose());
    };
  }, [primaryGeo, filamentGeo, meshGeo, deepGeo, nodeGeo, particleGeo]);

  useEffect(() => {
    return () => Object.values(materials).forEach((m) => m && m.dispose && m.dispose());
  }, [materials]);

  return (
    <group name="neural-wire-field-root" position={position} scale={scale}>
      {/* Layer 4 — deep background strands */}
      <lineSegments name="nwf-deep"      geometry={deepGeo}      material={materials.layer2Mat} frustumCulled={false} />
      {/* Layer 3 — triangulation mesh connections */}
      <lineSegments name="nwf-mesh"      geometry={meshGeo}      material={materials.layer1Mat} frustumCulled={false} />
      {/* Particle field */}
      <points       name="nwf-particles" geometry={particleGeo}  material={materials.particleMaterial} frustumCulled={false} />
      {/* Layer 2 — secondary filaments */}
      <lineSegments name="nwf-filaments" geometry={filamentGeo}  material={materials.layer0Mat} frustumCulled={false} />
      {/* Layer 1 — primary hero filaments (crisp single lines, elevated opacity) */}
      <lineSegments name="nwf-primary"   geometry={primaryGeo}   material={materials.primaryMat} frustumCulled={false} />
      {/* Node system */}
      <points       name="nwf-nodes"     geometry={nodeGeo}      material={materials.nodeMaterial} frustumCulled={false} />
    </group>
  );
}

/* ============================================================================
 * MODULE 6 — NeuralWirePreview (standalone vanilla-Three.js preview harness)
 * No R3F dependency required. Mounts directly into any div.
 * ========================================================================== */

export function NeuralWirePreview({
  theme       = DEFAULT_NEURAL_WIRE_THEME,
  enableBloom = true,
  targetAspect = 3.0,
  className   = '',
  style       = {},
}) {
  const outerRef    = useRef(null);
  const stageRef    = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef    = useRef(null);
  const cameraRef   = useRef(null);

  const [stageSize, setStageSize] = useState({
    width: 1425,
    height: 475,
    dpr: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
  });

  const effectiveTheme = useMemo(() => {
    if (enableBloom) return theme;
    return { ...DEFAULT_NEURAL_WIRE_THEME, ...(theme || {}),
      glowIntensity: ((theme && theme.glowIntensity) ?? 1.0) * 0.55 };
  }, [theme, enableBloom]);

  const resolvedTheme = useMemo(() => resolveNeuralWireTheme(effectiveTheme), [effectiveTheme]);

  const frustum = useMemo(
    () => computeFrustumDimensions(stageSize.width, stageSize.height, 34, 16),
    [stageSize.width, stageSize.height]
  );

  const layout = useMemo(
    () => computeResponsiveLayout(Math.round(frustum.viewportWidth * 2) / 2, Math.round(frustum.viewportHeight * 2) / 2),
    [frustum.viewportWidth, frustum.viewportHeight]
  );

  const { primaryGeo, filamentGeo, meshGeo, deepGeo, nodeGeo, particleGeo } = useMemo(() => {
    const wg = generateNeuralWireGeometry(layout);
    const pg = generateNeuralWireParticles(wg.canonicalVertices, layout);
    return { ...wg, particleGeo: pg };
  }, [layout]);

  const materials = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => createNeuralWireMaterials(resolvedTheme, stageSize.dpr), []
  );

  // Renderer bootstrap
  useEffect(() => {
    const outerEl = outerRef.current;
    const stageEl = stageRef.current;
    if (!outerEl || !stageEl) return undefined;

    const calcSize = () => {
      const aW = Math.max(outerEl.clientWidth  || window.innerWidth  || 1280, 320);
      const aH = Math.max(outerEl.clientHeight || window.innerHeight || 720,  240);
      const eff = aW < 560 ? Math.max(aW / aH, 1.85) : targetAspect;
      let sw = aW, sh = Math.round(sw / eff);
      if (sh > aH) { sh = aH; sw = Math.round(sh * eff); }
      return { width: Math.max(sw, 1), height: Math.max(sh, 1),
               dpr: Math.min(window.devicePixelRatio || 1, 2) };
    };

    const init = calcSize();
    stageEl.style.width  = `${init.width}px`;
    stageEl.style.height = `${init.height}px`;

    const scene  = new THREE.Scene();
    scene.background = new THREE.Color('#000000');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(34, init.width / Math.max(init.height, 1), 0.1, 100);
    camera.position.set(0, 0, 16);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(init.dpr);
    renderer.setSize(init.width, init.height, false);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width   = '100%';
    renderer.domElement.style.height  = '100%';
    stageEl.innerHTML = '';
    stageEl.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    setStageSize(init);

    const onResize = () => {
      if (!outerRef.current || !stageRef.current || !rendererRef.current || !cameraRef.current) return;
      const nx = calcSize();
      stageRef.current.style.width  = `${nx.width}px`;
      stageRef.current.style.height = `${nx.height}px`;
      cameraRef.current.aspect = nx.width / Math.max(nx.height, 1);
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setPixelRatio(nx.dpr);
      rendererRef.current.setSize(nx.width, nx.height, false);
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      setStageSize((prev) => {
        if (Math.abs(prev.width - nx.width) < 4 && Math.abs(prev.height - nx.height) < 4 && prev.dpr === nx.dpr) return prev;
        return nx;
      });
    };

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(onResize); ro.observe(outerEl); }
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      if (rendererRef.current) { rendererRef.current.dispose(); rendererRef.current = null; }
    };
  }, [targetAspect]);

  // Scene objects
  useEffect(() => {
    const scene    = sceneRef.current;
    const renderer = rendererRef.current;
    const camera   = cameraRef.current;
    if (!scene || !renderer || !camera) return undefined;

    const root = new THREE.Group();
    root.name  = 'neural-wire-field-root';

    const deepLines    = new THREE.LineSegments(deepGeo,     materials.layer2Mat);
    const meshLines    = new THREE.LineSegments(meshGeo,     materials.layer1Mat);
    const particles    = new THREE.Points      (particleGeo, materials.particleMaterial);
    const filLines     = new THREE.LineSegments(filamentGeo, materials.layer0Mat);
    const primaryLines = new THREE.LineSegments(primaryGeo,  materials.primaryMat);
    const nodes        = new THREE.Points      (nodeGeo,     materials.nodeMaterial);

    [deepLines, meshLines, particles, filLines, primaryLines, nodes].forEach((o) => {
      o.frustumCulled = false;
      root.add(o);
    });
    scene.add(root);
    
    // Phase 2: Animation loop for standalone preview
    const startTime = Date.now();
    let animationId = null;
    
    const animate = () => {
      const t = (Date.now() - startTime) * 0.001; // elapsed time in seconds
      
      // Update time uniforms for all wire materials
      ['layer2Mat', 'layer1Mat', 'layer0Mat', 'primaryMat'].forEach((k) => {
        const m = materials[k];
        if (m && m.uniforms.uTime) {
          m.uniforms.uTime.value = t;
        }
      });
      
      // Update node material
      if (materials.nodeMaterial && materials.nodeMaterial.uniforms.uTime) {
        materials.nodeMaterial.uniforms.uTime.value = t;
      }
      
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    
    animate();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      scene.remove(root);
    };
  }, [primaryGeo, filamentGeo, meshGeo, deepGeo, nodeGeo, particleGeo, materials]);

  // Theme updates
  useEffect(() => {
    updateNeuralWireMaterials(materials, resolvedTheme, stageSize.dpr);
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [materials, resolvedTheme, stageSize.dpr]);

  // Cleanup geometries
  useEffect(() => {
    return () => [primaryGeo, filamentGeo, meshGeo, deepGeo, nodeGeo, particleGeo]
      .forEach((g) => g && g.dispose());
  }, [primaryGeo, filamentGeo, meshGeo, deepGeo, nodeGeo, particleGeo]);

  // Cleanup materials
  useEffect(() => {
    return () => Object.values(materials).forEach((m) => m && m.dispose && m.dispose());
  }, [materials]);

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        width: '100%', height: '100vh',
        backgroundColor: '#000000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative', margin: 0, padding: 0,
        ...style,
      }}
    >
      <div
        ref={stageRef}
        style={{ position: 'relative', backgroundColor: '#000000', overflow: 'hidden' }}
      />
    </div>
  );
}

export default NeuralWirePreview;
