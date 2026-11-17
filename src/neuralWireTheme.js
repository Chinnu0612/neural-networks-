import * as THREE from 'three';

/**
 * DEFAULT_NEURAL_WIRE_THEME
 * Centralized dark-tech palette matching the reference composition.
 */
export const DEFAULT_NEURAL_WIRE_THEME = Object.freeze({
  primaryWireColor:   '#0066ff',  // Luminous electric cobalt-azure blue matching reference
  secondaryWireColor: '#004ee2',  // Deep sapphire electric blue with balanced cyan undertone
  accentWireColor:    '#8b5cf6',  // Brilliant electric royal violet / purple matching reference
  nodeColor:          '#005eff',  // Electric blue halo for node junctions & star flare auras
  highlightNodeColor: '#f2faff',  // Pure incandescent white for nexus cores & diffraction centers
  particleColor:      '#38bdf8',  // Celestial electric azure stardust matching reference plasma dust
  backgroundColor:    '#000000',  // Pure deep pitch black background
  opacity:            1.0,
  glowIntensity:      1.45,
});

/**
 * Resolves theme strings into instantiated THREE.Color instances and clamped numeric attributes.
 * @param {object} [customTheme={}]
 * @returns {object}
 */
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
    opacity:       THREE.MathUtils.clamp(Number(merged.opacity ?? 1.0), 0.0, 2.0),
    glowIntensity: THREE.MathUtils.clamp(Number(merged.glowIntensity ?? 1.0), 0.0, 2.5),
  };
}
