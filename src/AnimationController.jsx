import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useNeuralWireContext } from './neuralWireContextDef.js';

/**
 * AnimationController
 * Drives continuous organic undulation of wires, nexus nodes, and particle field
 * via useFrame((state, delta) => ...) cleanly without calling clock.getDelta().
 */
export function AnimationController({ active = true, speed = 1.0, materials = null }) {
  const ctx = useNeuralWireContext();
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    const mats = materials || ctx?.materials;
    if (!active || !mats) return;
    // Advance time cleanly using R3F's delta without calling clock.getDelta()
    const safeDelta = Math.min(delta, 0.1);
    timeRef.current += safeDelta * speed;
    const t = timeRef.current;

    const { primaryMat, layer0Mat, layer1Mat, layer2Mat, nodeMaterial, particleMaterial } = mats;
    if (primaryMat?.uniforms?.uTime) primaryMat.uniforms.uTime.value = t;
    if (layer0Mat?.uniforms?.uTime) layer0Mat.uniforms.uTime.value = t;
    if (layer1Mat?.uniforms?.uTime) layer1Mat.uniforms.uTime.value = t;
    if (layer2Mat?.uniforms?.uTime) layer2Mat.uniforms.uTime.value = t;
    if (nodeMaterial?.uniforms?.uTime) nodeMaterial.uniforms.uTime.value = t;
    if (particleMaterial?.uniforms?.uTime) particleMaterial.uniforms.uTime.value = t;
  });

  return null;
}

export default AnimationController;
