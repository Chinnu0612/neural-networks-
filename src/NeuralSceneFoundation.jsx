import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { initThreeConsoleFilter } from './consoleFilter.js';
import {
  DEFAULT_CAMERA_CONFIG,
  computeResponsiveCamera,
  computeFrustumDimensions,
  computeSpatialBounds,
} from './spatialConfig.js';
import { DEFAULT_NEURAL_WIRE_THEME } from './neuralWireTheme.js';
import NeuralWireProvider from './NeuralWireContext.jsx';
import NeuralNetworkField from './NeuralNetworkField.jsx';
import DepthLayers from './DepthLayers.jsx';
import PrimaryFilaments from './PrimaryFilaments.jsx';
import NeuralConnections from './NeuralConnections.jsx';
import NeuralNodes from './NeuralNodes.jsx';
import ParticleField from './ParticleField.jsx';
import NeuralWireMaterials from './NeuralWireMaterials.jsx';
import AnimationController from './AnimationController.jsx';

// Ensure upstream THREE.Clock deprecation warning is suppressed when Canvas mounts
initThreeConsoleFilter(THREE);

/**
 * Responsive Camera Manager
 * Synchronizes camera distance and aspect ratio with viewport changes,
 * preserving panoramic composition across arbitrary aspect ratios without distortion.
 * Uses exact frustum world calculations at focal plane Z = 0.
 */
function ResponsiveCameraManager({
  baseFov = DEFAULT_CAMERA_CONFIG.fov,
  baseCameraZ = DEFAULT_CAMERA_CONFIG.position[2],
  onBoundsChange,
}) {
  const { camera, size } = useThree();
  const lastStateRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const w = size.width;
    const h = Math.max(size.height, 1);
    if (w === lastStateRef.current.w && h === lastStateRef.current.h) return;
    lastStateRef.current = { w, h };

    const aspect = w / h;
    const { cameraZ, fov } = computeResponsiveCamera(aspect, baseFov, baseCameraZ);

    if (camera.isPerspectiveCamera) {
      camera.fov = fov;
      camera.aspect = aspect;
      camera.position.set(0, 0, cameraZ);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    if (onBoundsChange) {
      const frustum = computeFrustumDimensions(w, h, fov, cameraZ);
      const bounds = computeSpatialBounds(frustum.worldWidth, frustum.worldHeight);
      onBoundsChange(bounds);
    }
  }, [camera, size.width, size.height, baseFov, baseCameraZ, onBoundsChange]);

  return null;
}

/**
 * NeuralSceneFoundation
 * Foundational 3D scene setup using React Three Fiber with modular architectural slots:
 *   1. DepthLayers
 *   2. PrimaryFilaments
 *   3. NeuralConnections
 *   4. NeuralNodes
 *   5. ParticleField
 *   6. NeuralWireMaterials
 *   7. AnimationController
 * 
 * When enableWireframes is true, the architectural slots are populated with the
 * live procedural animated neural wireframes.
 * When enableWireframes is false, empty placeholder groups are rendered (Phase 1 foundation only).
 */
export function NeuralSceneFoundation({
  backgroundColor = '#000000',
  cameraConfig = DEFAULT_CAMERA_CONFIG,
  dpr = [1, 2],
  onBoundsChange,
  className = '',
  style = {},
  slots = {},
  enableWireframes = true,
  theme = DEFAULT_NEURAL_WIRE_THEME,
  animationIntensity = 1.0,
  children,
}) {
  const [internalBounds, setInternalBounds] = useState(null);

  const handleBoundsChange = useCallback((bounds) => {
    setInternalBounds(bounds);
    if (onBoundsChange) {
      onBoundsChange(bounds);
    }
  }, [onBoundsChange]);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor,
        overflow: 'hidden',
        ...style,
      }}
    >
      <Canvas
        dpr={dpr}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.NoToneMapping,
        }}
        camera={{
          fov: cameraConfig.fov,
          near: cameraConfig.near,
          far: cameraConfig.far,
          position: [0, 0, cameraConfig.position[2]],
        }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {/* Near-pure black scene background */}
        <color attach="background" args={[backgroundColor]} />

        {/* Dynamic responsive camera management */}
        <ResponsiveCameraManager
          baseFov={cameraConfig.fov}
          baseCameraZ={cameraConfig.position[2]}
          onBoundsChange={handleBoundsChange}
        />

        {/* Root Scene Graph Container with Modular Architectural Slots */}
        {enableWireframes ? (
          <NeuralWireProvider
            theme={theme}
            spatialBounds={internalBounds}
            animationIntensity={animationIntensity}
          >
            <group name="neural-wireframe-scene-root">
              {slots?.NeuralNetworkFieldLeft ?? <NeuralNetworkField side="left" slots={slots} />}
              {slots?.NeuralNetworkFieldRight ?? <NeuralNetworkField side="right" slots={slots} />}
              {slots?.NeuralWireMaterials ?? <NeuralWireMaterials />}
              {slots?.AnimationController ?? <AnimationController />}

              {children}
            </group>
          </NeuralWireProvider>
        ) : (
          <group name="neural-wireframe-scene-root">
            {slots?.DepthLayers ?? <group name="slot-depth-layers" />}
            {slots?.PrimaryFilaments ?? <group name="slot-primary-filaments" />}
            {slots?.NeuralConnections ?? <group name="slot-neural-connections" />}
            {slots?.NeuralNodes ?? <group name="slot-neural-nodes" />}
            {slots?.ParticleField ?? <group name="slot-particle-field" />}
            {slots?.NeuralWireMaterials ?? <group name="slot-neural-wire-materials" />}
            {slots?.AnimationController ?? <group name="slot-animation-controller" />}

            {children}
          </group>
        )}
      </Canvas>
    </div>
  );
}

export default NeuralSceneFoundation;
