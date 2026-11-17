import React from 'react';
import { useNeuralWireContext } from './neuralWireContextDef.js';

/**
 * NeuralNodes
 * 3-tier nexus nodes with pulsating glow:
 * - Tier 0: small crisp synaptic dots
 * - Tier 1: medium junction dots
 * - Tier 2: highlight nexus cores
 * - Tier 3: background bokeh
 */
export function NeuralNodes({ side = null, geometry, material, ...props }) {
  const ctx = useNeuralWireContext();
  let geo = geometry;
  if (!geo) {
    if (side === 'left') geo = ctx?.leftGeometries?.nodeGeo;
    else if (side === 'right') geo = ctx?.rightGeometries?.nodeGeo;
    else geo = ctx?.geometries?.nodeGeo;
  }
  const mat = material || ctx?.materials?.nodeMaterial;

  if (!geo || !mat) return null;

  return (
    <points
      name={side ? `nwf-nodes-${side}` : 'nwf-nodes'}
      geometry={geo}
      material={mat}
      frustumCulled={false}
      {...props}
    />
  );
}

export default NeuralNodes;
