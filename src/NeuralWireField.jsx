import React from 'react';
import NeuralWireProvider from './NeuralWireContext.jsx';
import NeuralNetworkField from './NeuralNetworkField.jsx';
import NeuralWireMaterials from './NeuralWireMaterials.jsx';
import AnimationController from './AnimationController.jsx';
import { DEFAULT_NEURAL_WIRE_THEME } from './neuralWireTheme.js';

/**
 * NeuralWireField
 * Composite neural wireframe field for mounting into any R3F Canvas.
 * Renders two independently configurable instances of the shared NeuralNetworkField:
 *   - Left instance: side="left"
 *   - Right instance: side="right"
 */
export function NeuralWireField({
  theme = DEFAULT_NEURAL_WIRE_THEME,
  spatialBounds = null,
  animationIntensity = 1.0,
  leftConfig = null,
  rightConfig = null,
  slots = {},
  position = [0, 0, 0],
  scale = 1,
}) {
  return (
    <NeuralWireProvider
      theme={theme}
      spatialBounds={spatialBounds}
      animationIntensity={animationIntensity}
      leftConfig={leftConfig}
      rightConfig={rightConfig}
    >
      <group name="neural-wire-field-root" position={position} scale={scale}>
        {slots?.NeuralNetworkFieldLeft ?? <NeuralNetworkField side="left" config={leftConfig} slots={slots} />}
        {slots?.NeuralNetworkFieldRight ?? <NeuralNetworkField side="right" config={rightConfig} slots={slots} />}
        {slots?.NeuralWireMaterials ?? <NeuralWireMaterials />}
        {slots?.AnimationController ?? <AnimationController />}
      </group>
    </NeuralWireProvider>
  );
}

export default NeuralWireField;
