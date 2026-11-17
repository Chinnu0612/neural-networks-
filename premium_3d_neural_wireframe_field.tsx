/**
 * PREMIUM 3D NEURAL WIREFRAME FIELD — MODULAR REACT THREE FIBER INTEGRATION
 *
 * Stack:
 *   React 19.2.6 · Three.js 0.184.0 · @react-three/fiber 9.8.2
 *
 * Re-exports the modular animated wireframes, Phase 1 scene foundation,
 * and preview components.
 * For spatial configuration constants and math utilities, import directly from:
 *   './src/spatialConfig.js' or './src/index.js'
 */

export { NeuralSceneFoundation } from './src/NeuralSceneFoundation.jsx';
export { NeuralWirePreview } from './src/NeuralWirePreview.jsx';
export { NeuralWireField } from './src/NeuralWireField.jsx';
export { NeuralNetworkField } from './src/NeuralNetworkField.jsx';
export { NeuralWireProvider } from './src/NeuralWireContext.jsx';
export { PrimaryFilaments } from './src/PrimaryFilaments.jsx';
export { NeuralConnections } from './src/NeuralConnections.jsx';
export { DepthLayers } from './src/DepthLayers.jsx';
export { NeuralNodes } from './src/NeuralNodes.jsx';
export { ParticleField } from './src/ParticleField.jsx';
export { NeuralWireMaterials } from './src/NeuralWireMaterials.jsx';
export { AnimationController } from './src/AnimationController.jsx';
export {
  DEFAULT_SIDE_PARAMS,
  resolveSideParams,
  generateSideGeometry,
  generateSideParticles,
  generateNeuralWireGeometry,
  generateNeuralWireParticles,
  mergeLineGeometries,
  mergeNodeGeometries,
  mergeParticleGeometries,
  computeResponsiveLayout,
} from './src/neuralWireGeometry.js';

import { NeuralWirePreview } from './src/NeuralWirePreview.jsx';
export default NeuralWirePreview;
