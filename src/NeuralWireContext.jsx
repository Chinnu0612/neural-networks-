import React, { useMemo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { NeuralWireContext } from './neuralWireContextDef.js';
import { DEFAULT_NEURAL_WIRE_THEME, resolveNeuralWireTheme } from './neuralWireTheme.js';
import { createNeuralWireMaterials, updateNeuralWireMaterials } from './neuralWireMaterials.js';
import {
  computeResponsiveLayout,
  generateSideGeometry,
  generateSideParticles,
  mergeLineGeometries,
  mergeNodeGeometries,
  mergeParticleGeometries,
  mergeGraphs,
} from './neuralWireGeometry.js';
import {
  DEFAULT_SPATIAL_BOUNDS,
  computeFrustumDimensions,
  computeResponsiveCamera,
  computeSpatialBounds,
} from './spatialConfig.js';

export function NeuralWireProvider({
  theme = DEFAULT_NEURAL_WIRE_THEME,
  spatialBounds = null,
  animationIntensity = 1.0,
  leftConfig = null,
  rightConfig = null,
  children,
}) {
  const { size, gl } = useThree();
  const dpr = gl?.getPixelRatio ? gl.getPixelRatio() : 1;

  // Resolve spatial bounds
  const currentBounds = useMemo(() => {
    if (spatialBounds) return spatialBounds;
    const aspect = size.width / Math.max(size.height, 1);
    const { cameraZ, fov } = computeResponsiveCamera(aspect);
    const frustum = computeFrustumDimensions(size.width, size.height, fov, cameraZ);
    return computeSpatialBounds(frustum.worldWidth, frustum.worldHeight);
  }, [spatialBounds, size.width, size.height]);

  // Resolve responsive layout
  const layout = useMemo(() => {
    const w = Math.round((currentBounds.worldWidth || 29.35) * 2) / 2;
    const h = Math.round((currentBounds.worldHeight || 9.78) * 2) / 2;
    return computeResponsiveLayout(w, h, currentBounds);
  }, [currentBounds]);

  // Procedural geometries: generate left and right once, merge buffers efficiently for backwards compatibility
  const geometriesData = useMemo(() => {
    const leftWire = generateSideGeometry('left', layout, leftConfig);
    const rightWire = generateSideGeometry('right', layout, rightConfig);
    const leftParticles = generateSideParticles(leftWire.canonicalVertices, layout, currentBounds, 'left', leftConfig);
    const rightParticles = generateSideParticles(rightWire.canonicalVertices, layout, currentBounds, 'right', rightConfig);

    const left = { ...leftWire, particleGeo: leftParticles };
    const right = { ...rightWire, particleGeo: rightParticles };

    const merged = {
      left,
      right,
      primaryGeo:  mergeLineGeometries(left.primaryGeo, right.primaryGeo),
      filamentGeo: mergeLineGeometries(left.filamentGeo, right.filamentGeo),
      meshGeo:     mergeLineGeometries(left.meshGeo, right.meshGeo),
      deepGeo:     mergeLineGeometries(left.deepGeo, right.deepGeo),
      nodeGeo:     mergeNodeGeometries(left.nodeGeo, right.nodeGeo),
      particleGeo: mergeParticleGeometries(leftParticles, rightParticles),
      canonicalVertices: [...leftWire.canonicalVertices, ...rightWire.canonicalVertices],
      graph:       mergeGraphs(leftWire.graph, rightWire.graph),
    };

    return { left, right, merged };
  }, [layout, currentBounds, leftConfig, rightConfig]);

  // Clean disposal of BufferGeometries on recompute or unmount
  useEffect(() => {
    return () => {
      if (geometriesData) {
        [geometriesData.left, geometriesData.right, geometriesData.merged].forEach((set) => {
          if (!set) return;
          const { primaryGeo, filamentGeo, meshGeo, deepGeo, nodeGeo, particleGeo } = set;
          [primaryGeo, filamentGeo, meshGeo, deepGeo, nodeGeo, particleGeo].forEach(
            (g) => g && g.dispose()
          );
        });
      }
    };
  }, [geometriesData]);

  // Resolved theme & materials
  const resolvedTheme = useMemo(() => resolveNeuralWireTheme(theme), [theme]);

  const materials = useMemo(
    () => createNeuralWireMaterials(resolvedTheme, dpr),
    [resolvedTheme, dpr]
  );

  useEffect(() => {
    updateNeuralWireMaterials(materials, resolvedTheme, dpr);
  }, [materials, resolvedTheme, dpr]);

  // Update animation intensity uniform
  useEffect(() => {
    if (!materials) return;
    ['primaryMat', 'layer0Mat', 'layer1Mat', 'layer2Mat'].forEach((k) => {
      const m = materials[k];
      if (m?.uniforms?.uAnimationIntensity) {
        m.uniforms.uAnimationIntensity.value = animationIntensity;
      }
    });
    if (materials.nodeMaterial?.uniforms?.uAnimationIntensity) {
      materials.nodeMaterial.uniforms.uAnimationIntensity.value = animationIntensity;
    }
    if (materials.particleMaterial?.uniforms?.uAnimationIntensity) {
      materials.particleMaterial.uniforms.uAnimationIntensity.value = animationIntensity;
    }
  }, [materials, animationIntensity]);

  // Clean disposal of ShaderMaterials on unmount
  useEffect(() => {
    return () => {
      if (materials) {
        Object.values(materials).forEach((m) => m && m.dispose && m.dispose());
      }
    };
  }, [materials]);

  const contextValue = useMemo(() => ({
    materials,
    geometries: geometriesData.merged,
    leftGeometries: geometriesData.left,
    rightGeometries: geometriesData.right,
    layout,
    spatialBounds: currentBounds || DEFAULT_SPATIAL_BOUNDS,
    resolvedTheme,
    dpr,
    animationIntensity,
  }), [materials, geometriesData, layout, currentBounds, resolvedTheme, dpr, animationIntensity]);

  return (
    <NeuralWireContext.Provider value={contextValue}>
      {children}
    </NeuralWireContext.Provider>
  );
}

export default NeuralWireProvider;
