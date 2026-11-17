import React from 'react';
import { useNeuralWireContext } from './neuralWireContextDef.js';

/**
 * NeuralConnections
 * Organic network lines interconnecting nodes.
 * Combines secondary filament flow with non-crossing irregular triangulation mesh lines.
 */
export function NeuralConnections({
  side = null,
  filamentGeometry,
  filamentMaterial,
  meshGeometry,
  meshMaterial,
  ...props
}) {
  const ctx = useNeuralWireContext();
  let filGeo = filamentGeometry;
  let meshGeo = meshGeometry;
  if (!filGeo) {
    if (side === 'left') filGeo = ctx?.leftGeometries?.filamentGeo;
    else if (side === 'right') filGeo = ctx?.rightGeometries?.filamentGeo;
    else filGeo = ctx?.geometries?.filamentGeo;
  }
  if (!meshGeo) {
    if (side === 'left') meshGeo = ctx?.leftGeometries?.meshGeo;
    else if (side === 'right') meshGeo = ctx?.rightGeometries?.meshGeo;
    else meshGeo = ctx?.geometries?.meshGeo;
  }
  const filMat = filamentMaterial || ctx?.materials?.layer0Mat;
  const meshMat = meshMaterial || ctx?.materials?.layer1Mat;

  if (!filGeo && !meshGeo) return null;

  return (
    <group name={side ? `slot-neural-connections-${side}` : 'slot-neural-connections-content'} {...props}>
      {filGeo && filMat && (
        <lineSegments
          name={side ? `nwf-filaments-${side}` : 'nwf-filaments'}
          geometry={filGeo}
          material={filMat}
          frustumCulled={false}
        />
      )}
      {meshGeo && meshMat && (
        <lineSegments
          name={side ? `nwf-mesh-${side}` : 'nwf-mesh'}
          geometry={meshGeo}
          material={meshMat}
          frustumCulled={false}
        />
      )}
    </group>
  );
}

export default NeuralConnections;
