// Spatial configuration and boundaries
export {
  REFERENCE_ASPECT_RATIO,
  PROPORTIONS,
  DEFAULT_CAMERA_CONFIG,
  DEPTH_RANGE,
  RESPONSIVE_TIERS,
  ARCHITECTURAL_SLOTS,
  DEFAULT_SPATIAL_BOUNDS,
  getDeviceTier,
  computeFrustumDimensions,
  computeResponsiveCamera,
  computeSpatialBounds,
  isWithinCentralExclusion,
  clampToFormation,
} from './spatialConfig.js';

// Console filter
export { createThreeConsoleFilter, initThreeConsoleFilter } from './consoleFilter.js';

// Theme
export { DEFAULT_NEURAL_WIRE_THEME, resolveNeuralWireTheme } from './neuralWireTheme.js';

// Shaders
export {
  WIRE_VERT,
  WIRE_FRAG,
  NODE_VERT,
  NODE_FRAG,
  PARTICLE_VERT,
  PARTICLE_FRAG,
} from './neuralWireShaders.js';

// Materials
export {
  createNeuralWireMaterials,
  updateNeuralWireMaterials,
} from './neuralWireMaterials.js';

// Geometry & procedural generation
export {
  createSeededRandom,
  computeResponsiveLayout,
  evalSurface,
  makeStrandDescriptors,
  vertexAppearance,
  NeuralGraph,
  DEFAULT_SIDE_PARAMS,
  resolveSideParams,
  generateSideGeometry,
  generateSideParticles,
  generateNeuralWireGeometry,
  generateNeuralWireParticles,
  mergeLineGeometries,
  mergeNodeGeometries,
  mergeParticleGeometries,
  mergeGraphs,
} from './neuralWireGeometry.js';

// Context & Hook
export { NeuralWireContext, useNeuralWireContext } from './neuralWireContextDef.js';
export { NeuralWireProvider } from './NeuralWireContext.jsx';

// Modular R3F architectural components
export { PrimaryFilaments } from './PrimaryFilaments.jsx';
export { NeuralConnections } from './NeuralConnections.jsx';
export { DepthLayers } from './DepthLayers.jsx';
export { NeuralNodes } from './NeuralNodes.jsx';
export { ParticleField } from './ParticleField.jsx';
export { NeuralWireMaterials } from './NeuralWireMaterials.jsx';
export { AnimationController } from './AnimationController.jsx';
export { NeuralNetworkField } from './NeuralNetworkField.jsx';
export { NeuralWireField } from './NeuralWireField.jsx';

// Scene Foundation & Preview Harness
export { NeuralSceneFoundation } from './NeuralSceneFoundation.jsx';
export { NeuralWirePreview } from './NeuralWirePreview.jsx';

export default NeuralWirePreview;
