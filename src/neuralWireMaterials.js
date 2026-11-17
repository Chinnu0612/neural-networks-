import * as THREE from 'three';
import {
  WIRE_VERT, WIRE_FRAG,
  NODE_VERT, NODE_FRAG,
  PARTICLE_VERT, PARTICLE_FRAG,
} from './neuralWireShaders.js';

/**
 * Creates custom GLSL ShaderMaterials for all neural wireframe components.
 * @param {object} resolvedTheme
 * @param {number} [pixelRatio=1]
 * @returns {object} Set of ShaderMaterial instances
 */
export function createNeuralWireMaterials(resolvedTheme, pixelRatio = 1) {
  const { colors, opacity, glowIntensity } = resolvedTheme;
  const dpr = Math.min(pixelRatio, 2);

  const makeWire = (layerOpacityScale) => new THREE.ShaderMaterial({
    vertexShader:   WIRE_VERT,
    fragmentShader: WIRE_FRAG,
    uniforms: {
      uPrimaryColor:       { value: colors.primaryWire.clone()   },
      uSecondaryColor:     { value: colors.secondaryWire.clone() },
      uAccentColor:        { value: colors.accentWire.clone()    },
      uHighlightColor:     { value: colors.highlightNode.clone() },
      uOpacity:            { value: opacity       },
      uGlowIntensity:      { value: glowIntensity },
      uLayerOpacityScale:  { value: layerOpacityScale },
      uTime:               { value: 0.0 },
      uAnimationIntensity: { value: 1.0 },
    },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  const nodeMaterial = new THREE.ShaderMaterial({
    vertexShader:   NODE_VERT,
    fragmentShader: NODE_FRAG,
    uniforms: {
      uPrimaryColor:       { value: colors.primaryWire.clone()   },
      uSecondaryColor:     { value: colors.secondaryWire.clone() },
      uAccentColor:        { value: colors.accentWire.clone()    },
      uNodeColor:          { value: colors.node.clone()          },
      uHighlightColor:     { value: colors.highlightNode.clone() },
      uOpacity:            { value: opacity       },
      uGlowIntensity:      { value: glowIntensity },
      uPixelRatio:         { value: dpr           },
      uTime:               { value: 0.0 },
      uAnimationIntensity: { value: 1.0 },
    },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  const particleMaterial = new THREE.ShaderMaterial({
    vertexShader:   PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    uniforms: {
      uParticleColor:      { value: colors.particle.clone()      },
      uSecondaryColor:     { value: colors.secondaryWire.clone() },
      uAccentColor:        { value: colors.accentWire.clone()    },
      uHighlightColor:     { value: colors.highlightNode.clone() },
      uOpacity:            { value: opacity       },
      uGlowIntensity:      { value: glowIntensity },
      uPixelRatio:         { value: dpr           },
      uTime:               { value: 0.0 },
      uAnimationIntensity: { value: 1.0 },
    },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  return {
    primaryMat: makeWire(1.00), // Primary filaments — full opacity
    layer0Mat:  makeWire(0.90), // Secondary filaments foreground
    layer1Mat:  makeWire(0.72), // Triangulation mesh connections
    layer2Mat:  makeWire(0.50), // Deep background strands
    nodeMaterial,
    particleMaterial,
  };
}

/**
 * Updates uniforms on materials without recreating shaders.
 * @param {object} materials
 * @param {object} resolvedTheme
 * @param {number} [pixelRatio=1]
 */
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
    m.uniforms.uOpacity.value       = opacity;
    m.uniforms.uGlowIntensity.value = glowIntensity;
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
