import React from 'react';
import { createRoot } from 'react-dom/client';
import { NeuralWirePreview } from './premium_3d_neural_wireframe_field.tsx';

createRoot(document.getElementById('root')).render(
  <NeuralWirePreview
    targetAspect={3.0}
    enableBloom={true}
  />
);
