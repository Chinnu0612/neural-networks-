import React from 'react';
import { useNeuralWireContext } from './neuralWireContextDef.js';

/**
 * ParticleField
 * Ambient floating particles clustered around neural wire formations.
 */
export function ParticleField({ side = null, geometry, material, ...props }) {
  const ctx = useNeuralWireContext();
  let geo = geometry;
  if (!geo) {
    if (side === 'left') geo = ctx?.leftGeometries?.particleGeo;
    else if (side === 'right') geo = ctx?.rightGeometries?.particleGeo;
    else geo = ctx?.geometries?.particleGeo;
  }
  const mat = material || ctx?.materials?.particleMaterial;

  if (!geo || !mat) return null;

  return (
    <points
      name={side ? `nwf-particles-${side}` : 'nwf-particles'}
      geometry={geo}
      material={mat}
      frustumCulled={false}
      {...props}
    />
  );
}

export default ParticleField;
