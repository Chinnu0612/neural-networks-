import React from 'react';
import { useNeuralWireContext } from './neuralWireContextDef.js';

/**
 * PrimaryFilaments
 * Procedural optical-fiber S-curves flanking left and right sides.
 * Electric-cyan hero pathways rendered as crisp single lines with elevated opacity.
 */
export function PrimaryFilaments({ side = null, geometry, material, ...props }) {
  const ctx = useNeuralWireContext();
  let geo = geometry;
  if (!geo) {
    if (side === 'left') geo = ctx?.leftGeometries?.primaryGeo;
    else if (side === 'right') geo = ctx?.rightGeometries?.primaryGeo;
    else geo = ctx?.geometries?.primaryGeo;
  }
  const mat = material || ctx?.materials?.primaryMat;

  if (!geo || !mat) return null;

  return (
    <lineSegments
      name={side ? `nwf-primary-${side}` : 'nwf-primary'}
      geometry={geo}
      material={mat}
      frustumCulled={false}
      {...props}
    />
  );
}

export default PrimaryFilaments;
