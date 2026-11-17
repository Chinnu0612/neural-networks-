import React from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { createThreeConsoleFilter } from './src/consoleFilter.js';
import { NeuralWirePreview } from './src/NeuralWirePreview.jsx';

// Suppress upstream THREE.Clock deprecation warning emitted by @react-three/fiber
// when <Canvas> mounts, while preserving all real errors, warnings, and TSL stack traces.
THREE.setConsoleFunction(createThreeConsoleFilter(THREE.getConsoleFunction()));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NeuralWirePreview targetAspect={3.0} showSpatialGuide={true} />
  </React.StrictMode>
);
