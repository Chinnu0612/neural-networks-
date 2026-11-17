import React, { useMemo, useEffect } from 'react';
import { useNeuralWireContext } from './neuralWireContextDef.js';
import DepthLayers from './DepthLayers.jsx';
import NeuralConnections from './NeuralConnections.jsx';
import ParticleField from './ParticleField.jsx';
import PrimaryFilaments from './PrimaryFilaments.jsx';
import NeuralNodes from './NeuralNodes.jsx';
import {
  computeResponsiveLayout,
  generateSideGeometry,
  generateSideParticles,
} from './neuralWireGeometry.js';
import { DEFAULT_SPATIAL_BOUNDS } from './spatialConfig.js';
import { resolveNeuralWireTheme } from './neuralWireTheme.js';
import { createNeuralWireMaterials } from './neuralWireMaterials.js';

/**
 * NeuralNetworkField
 * Reusable single-formation neural network component.
 * Rendered twice:
 *   - Left instance: side="left"
 *   - Right instance: side="right"
 * 
 * Both instances share identical geometry generation architecture, material shaders,
 * and rendering pipeline with subtle deterministic geometric variations.
 * 
 * Independently configurable via `config` prop (phase offsets, curvature, amplitude, depth).
 * Supports architectural slots and graceful standalone operation without NeuralWireProvider.
 */
export function NeuralNetworkField({
  side = 'left',
  geometries = null,
  materials = null,
  config = null,
  slots = {},
  position = [0, 0, 0],
  scale = 1,
  ...props
}) {
  const ctx = useNeuralWireContext();

  const contextGeo = side === 'right' ? ctx?.rightGeometries : ctx?.leftGeometries;

  // Graceful standalone fallback: if not inside NeuralWireProvider and geometries not passed
  const standaloneGeo = useMemo(() => {
    if (geometries || contextGeo) return null;
    const bounds = ctx?.spatialBounds || DEFAULT_SPATIAL_BOUNDS;
    const layout = computeResponsiveLayout(bounds.worldWidth, bounds.worldHeight, bounds);
    const wire = generateSideGeometry(side, layout, config);
    const particles = generateSideParticles(wire.canonicalVertices, layout, bounds, side, config);
    return { ...wire, particleGeo: particles };
  }, [geometries, contextGeo, ctx?.spatialBounds, side, config]);

  useEffect(() => {
    return () => {
      if (standaloneGeo) {
        const { primaryGeo, filamentGeo, meshGeo, deepGeo, nodeGeo, particleGeo } = standaloneGeo;
        [primaryGeo, filamentGeo, meshGeo, deepGeo, nodeGeo, particleGeo].forEach(
          (g) => g && g.dispose()
        );
      }
    };
  }, [standaloneGeo]);

  const standaloneMats = useMemo(() => {
    if (materials || ctx?.materials) return null;
    const theme = resolveNeuralWireTheme();
    return createNeuralWireMaterials(theme, 1);
  }, [materials, ctx?.materials]);

  useEffect(() => {
    return () => {
      if (standaloneMats) {
        Object.values(standaloneMats).forEach((m) => m && m.dispose && m.dispose());
      }
    };
  }, [standaloneMats]);

  const sideGeo = geometries || contextGeo || standaloneGeo;
  const mats = materials || ctx?.materials || standaloneMats;

  return (
    <group name={`neural-network-field-${side}`} position={position} scale={scale} {...props}>
      {slots?.DepthLayers ?? (
        <DepthLayers side={side} geometry={sideGeo?.deepGeo} material={mats?.layer2Mat} />
      )}
      {slots?.NeuralConnections ?? (
        <NeuralConnections
          side={side}
          filamentGeometry={sideGeo?.filamentGeo}
          filamentMaterial={mats?.layer0Mat}
          meshGeometry={sideGeo?.meshGeo}
          meshMaterial={mats?.layer1Mat}
        />
      )}
      {slots?.ParticleField ?? (
        <ParticleField side={side} geometry={sideGeo?.particleGeo} material={mats?.particleMaterial} />
      )}
      {slots?.PrimaryFilaments ?? (
        <PrimaryFilaments side={side} geometry={sideGeo?.primaryGeo} material={mats?.primaryMat} />
      )}
      {slots?.NeuralNodes ?? (
        <NeuralNodes side={side} geometry={sideGeo?.nodeGeo} material={mats?.nodeMaterial} />
      )}
    </group>
  );
}

export default NeuralNetworkField;
