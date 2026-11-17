import React from 'react';
import { useNeuralWireContext } from './neuralWireContextDef.js';

/**
 * DepthLayers
 * Deep background neural strands for spatial immersion and depth cueing.
 */
export function DepthLayers({ side = null, geometry, material, ...props }) {
  const ctx = useNeuralWireContext();
  let geo = geometry;
  if (!geo) {
    if (side === 'left') geo = ctx?.leftGeometries?.deepGeo;
    else if (side === 'right') geo = ctx?.rightGeometries?.deepGeo;
    else geo = ctx?.geometries?.deepGeo;
  }
  const mat = material || ctx?.materials?.layer2Mat;

  if (!geo || !mat) return null;

  return (
    <lineSegments
      name={side ? `nwf-deep-${side}` : 'nwf-deep'}
      geometry={geo}
      material={mat}
      frustumCulled={false}
      {...props}
    />
  );
}

export default DepthLayers;
