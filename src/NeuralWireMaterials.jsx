import React from 'react';
import { useNeuralWireContext } from './neuralWireContextDef.js';

/**
 * NeuralWireMaterials
 * Architectural integration slot for neural wire custom GLSL materials.
 * Supports direct child components or a functional render prop: (ctx) => ReactNode.
 */
export function NeuralWireMaterials({ children }) {
  const ctx = useNeuralWireContext();
  if (typeof children === 'function') {
    return children(ctx);
  }
  return children || null;
}

export default NeuralWireMaterials;
