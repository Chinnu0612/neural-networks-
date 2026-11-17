import fs from 'fs';
import { DEFAULT_SPATIAL_BOUNDS, isWithinCentralExclusion } from './src/spatialConfig.js';
import {
  computeResponsiveLayout,
  generateSideGeometry,
  generateSideParticles,
  generateNeuralWireGeometry,
  generateNeuralWireParticles,
  DEFAULT_SIDE_PARAMS,
  resolveSideParams,
  mergeLineGeometries,
  mergeNodeGeometries,
  mergeParticleGeometries,
} from './src/neuralWireGeometry.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${msg}`);
  }
}

console.log('\n================================================================');
console.log('UNIFIED LEFT AND RIGHT NEURAL NETWORK REFINEMENT VERIFICATION');
console.log('================================================================\n');

// 1. Shared Geometry Component & Export Check
console.log('1. Shared Geometry Component Architecture & Reusability:');
assert(fs.existsSync('./src/NeuralNetworkField.jsx'), 'src/NeuralNetworkField.jsx component file exists');
const nnfContent = fs.readFileSync('./src/NeuralNetworkField.jsx', 'utf8');
assert(nnfContent.includes('export function NeuralNetworkField'), 'NeuralNetworkField is exported as named component');
assert(nnfContent.includes('side = \'left\''), 'NeuralNetworkField supports side="left" by default');
assert(nnfContent.includes('side === \'right\''), 'NeuralNetworkField supports side="right" configuration');
assert(nnfContent.includes('config = null'), 'NeuralNetworkField supports independent config overrides');
assert(nnfContent.includes('slots = {}'), 'NeuralNetworkField supports architectural slot customisation');
assert(nnfContent.includes('standaloneGeo'), 'NeuralNetworkField implements graceful standalone fallback when unparented');

const nwfContent = fs.readFileSync('./src/NeuralWireField.jsx', 'utf8');
assert(nwfContent.includes('<NeuralNetworkField side="left"'), 'NeuralWireField renders NeuralNetworkField side="left"');
assert(nwfContent.includes('<NeuralNetworkField side="right"'), 'NeuralWireField renders NeuralNetworkField side="right"');

const indexContent = fs.readFileSync('./src/index.js', 'utf8');
assert(indexContent.includes('export { NeuralNetworkField }'), 'src/index.js exports NeuralNetworkField');
assert(indexContent.includes('DEFAULT_SIDE_PARAMS'), 'src/index.js exports DEFAULT_SIDE_PARAMS');
assert(indexContent.includes('resolveSideParams'), 'src/index.js exports resolveSideParams');
assert(indexContent.includes('generateSideGeometry'), 'src/index.js exports generateSideGeometry');
assert(indexContent.includes('generateSideParticles'), 'src/index.js exports generateSideParticles');
assert(indexContent.includes('mergeLineGeometries'), 'src/index.js exports mergeLineGeometries');
assert(indexContent.includes('mergeParticleGeometries'), 'src/index.js exports mergeParticleGeometries');

assert(typeof generateSideGeometry === 'function', 'generateSideGeometry procedural generator is exported');
assert(typeof generateSideParticles === 'function', 'generateSideParticles procedural generator is exported');
assert(typeof mergeLineGeometries === 'function', 'mergeLineGeometries utility is exported');
assert(typeof mergeParticleGeometries === 'function', 'mergeParticleGeometries utility is exported');

// 2. Deterministic Side Parameters Configuration
console.log('\n2. Deterministic Side Parameters Structure:');
assert(typeof DEFAULT_SIDE_PARAMS === 'object' && DEFAULT_SIDE_PARAMS !== null, 'DEFAULT_SIDE_PARAMS is defined');
assert(typeof DEFAULT_SIDE_PARAMS.left === 'object', 'DEFAULT_SIDE_PARAMS has left configuration');
assert(typeof DEFAULT_SIDE_PARAMS.right === 'object', 'DEFAULT_SIDE_PARAMS has right configuration');
assert(DEFAULT_SIDE_PARAMS.left.seed === DEFAULT_SIDE_PARAMS.right.seed, 'Left and right seeds are identical');
assert(DEFAULT_SIDE_PARAMS.left.wavePhase0 === DEFAULT_SIDE_PARAMS.right.wavePhase0, 'Left and right wavePhase0 are identical');

const customResolved = resolveSideParams('left', { wavePhase0: 0.77, customKey: 123 });
assert(customResolved.wavePhase0 === 0.77, 'resolveSideParams merges custom parameter overrides');
assert(customResolved.seed === DEFAULT_SIDE_PARAMS.left.seed, 'resolveSideParams retains default seed when not overridden');

const bounds = DEFAULT_SPATIAL_BOUNDS;
const layout = computeResponsiveLayout(bounds.worldWidth, bounds.worldHeight, bounds);

// 3. Generate Left and Right Formations independently
console.log('\n3. Independent Left and Right Formations Generation:');
const leftGeo = generateSideGeometry('left', layout);
const rightGeo = generateSideGeometry('right', layout);
const leftParticles = generateSideParticles(leftGeo.canonicalVertices, layout, bounds, 'left');
const rightParticles = generateSideParticles(rightGeo.canonicalVertices, layout, bounds, 'right');

assert(leftGeo.side === 'left', 'Left geometry instance has side="left"');
assert(rightGeo.side === 'right', 'Right geometry instance has side="right"');

// 4. Horizontal and Vertical Coverage Metrics
console.log('\n4. Spatial Coverage & Visual Balance:');
function getGeoBounds(geo) {
  const pos = geo.getAttribute('position');
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, width: maxX - minX, minY, maxY, height: maxY - minY, minZ, maxZ, depth: maxZ - minZ, count: pos.count };
}

const leftPrimary = getGeoBounds(leftGeo.primaryGeo);
const rightPrimary = getGeoBounds(rightGeo.primaryGeo);
console.log(`  Left Primary width: ${leftPrimary.width.toFixed(3)}, height: ${leftPrimary.height.toFixed(3)} [Y: ${leftPrimary.minY.toFixed(2)} to ${leftPrimary.maxY.toFixed(2)}]`);
console.log(`  Right Primary width: ${rightPrimary.width.toFixed(3)}, height: ${rightPrimary.height.toFixed(3)} [Y: ${rightPrimary.minY.toFixed(2)} to ${rightPrimary.maxY.toFixed(2)}]`);

const widthDiff = Math.abs(leftPrimary.width - rightPrimary.width);
assert(widthDiff < 0.1, `Horizontal formation width matches within 0.1 units (Diff: ${widthDiff.toFixed(4)})`);

const heightDiff = Math.abs(leftPrimary.height - rightPrimary.height);
assert(heightDiff < 0.25, `Vertical formation coverage matches within 0.25 units (Diff: ${heightDiff.toFixed(4)})`);

const leftAllNodes = getGeoBounds(leftGeo.nodeGeo);
const rightAllNodes = getGeoBounds(rightGeo.nodeGeo);
console.log(`  Left Node count: ${leftAllNodes.count}, Right Node count: ${rightAllNodes.count}`);
const nodeCountDiffRatio = Math.abs(leftAllNodes.count - rightAllNodes.count) / Math.max(leftAllNodes.count, 1);
assert(nodeCountDiffRatio < 0.05, `Node count is balanced within 5% (Diff ratio: ${(nodeCountDiffRatio * 100).toFixed(2)}%)`);

// 5. Particle Field Distribution Symmetry
console.log('\n5. Particle Field Density & Symmetry:');
const pL = getGeoBounds(leftParticles);
const pR = getGeoBounds(rightParticles);
console.log(`  Left Particles: ${pL.count}, Right Particles: ${pR.count}`);
assert(pL.count === pR.count, `Left and Right particle counts are exactly equal (${pL.count} vs ${pR.count})`);

// 6. Central Exclusion Zone Integrity
console.log('\n6. Central Negative Void Enforcement:');
let violations = 0;
[leftGeo.primaryGeo, leftGeo.filamentGeo, leftGeo.meshGeo, leftGeo.deepGeo, leftGeo.nodeGeo, leftParticles,
 rightGeo.primaryGeo, rightGeo.filamentGeo, rightGeo.meshGeo, rightGeo.deepGeo, rightGeo.nodeGeo, rightParticles].forEach((g) => {
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    if (isWithinCentralExclusion(pos.getX(i), bounds)) violations++;
  }
});
assert(violations === 0, `Total central exclusion violations across both independent instances: ${violations}`);

// 7. Exact Symmetrical Mirroring Check
console.log('\n7. Exact Symmetrical Formations (Right Exactly Mirrors Left):');
let identicalPoints = 0;
const lPos = leftGeo.primaryGeo.getAttribute('position');
const rPos = rightGeo.primaryGeo.getAttribute('position');
const nCheck = Math.min(lPos.count, rPos.count);
for (let i = 0; i < nCheck; i++) {
  const lx = lPos.getX(i), ly = lPos.getY(i), lz = lPos.getZ(i);
  const rx = rPos.getX(i), ry = rPos.getY(i), rz = rPos.getZ(i);
  if (Math.abs(-lx - rx) < 1e-4 && Math.abs(ly - ry) < 1e-4 && Math.abs(lz - rz) < 1e-4) {
    identicalPoints++;
  }
}
assert(identicalPoints === nCheck, `Right formation exactly mirrors left formation: ${identicalPoints} identical mirrored points out of ${nCheck}`);

// 8. Efficient Merged Buffer Reuse Check
console.log('\n8. Efficient Merged Geometry Buffer Reuse:');
const mergedFast = {
  primaryGeo: mergeLineGeometries(leftGeo.primaryGeo, rightGeo.primaryGeo),
  particleGeo: mergeParticleGeometries(leftParticles, rightParticles),
};
const mPrimaryCount = mergedFast.primaryGeo.getAttribute('position').count;
const mParticleCount = mergedFast.particleGeo.getAttribute('position').count;
assert(mPrimaryCount === leftPrimary.count + rightPrimary.count, `Merged primary count exactly matches sum of sides (${mPrimaryCount} === ${leftPrimary.count} + ${rightPrimary.count})`);
assert(mParticleCount === pL.count + pR.count, `Merged particle count exactly matches sum of sides (${mParticleCount} === ${pL.count} + ${pR.count})`);

// 9. Independent Config Customization Verification
console.log('\n9. Independent Configuration Override Test:');
const customRightGeo = generateSideGeometry('right', layout, { wavePhase0: 1.15, ampScale: 0.92 });
const customRightPrimary = getGeoBounds(customRightGeo.primaryGeo);
assert(customRightPrimary.height !== rightPrimary.height, `Custom parameter override successfully altered geometry (${customRightPrimary.height.toFixed(3)} !== ${rightPrimary.height.toFixed(3)})`);

let customViolations = 0;
const cPos = customRightGeo.primaryGeo.getAttribute('position');
for (let i = 0; i < cPos.count; i++) {
  if (isWithinCentralExclusion(cPos.getX(i), bounds)) customViolations++;
}
assert(customViolations === 0, `Custom configuration maintains strict central void integrity (${customViolations} violations)`);

console.log('\n================================================================');
console.log(`Refinement verification results: ${passed} passed, ${failed} failed.`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);
