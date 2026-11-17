/**
 * Phase 1 Spatial Configuration and Composition Verification Suite
 * Deep invariant testing across proportions, boundaries, central exclusion,
 * camera framing, device tiers, architectural integration, and edge cases.
 */

import {
  REFERENCE_ASPECT_RATIO,
  PROPORTIONS,
  DEFAULT_CAMERA_CONFIG,
  DEPTH_RANGE,
  RESPONSIVE_TIERS,
  ARCHITECTURAL_SLOTS,
  DEFAULT_SPATIAL_BOUNDS,
  getDeviceTier,
  computeFrustumDimensions,
  computeResponsiveCamera,
  computeSpatialBounds,
  isWithinCentralExclusion,
  clampToFormation,
} from './src/spatialConfig.js';

let failedTests = 0;
let passedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

console.log('\n================================================================');
console.log('PHASE 1 DEEP VERIFICATION: SPATIAL FOUNDATION & COMPOSITION');
console.log('================================================================\n');

// --------------------------------------------------------------------------
// 1. Proportions Constant Invariants
// --------------------------------------------------------------------------
console.log('1. Proportions Configuration:');
assert(REFERENCE_ASPECT_RATIO === 3.0, 'Reference aspect ratio is 3.0:1');
assert(
  PROPORTIONS.LEFT_WIDTH_RATIO >= 0.39 && PROPORTIONS.LEFT_WIDTH_RATIO <= 0.40,
  `Left region proportion ${PROPORTIONS.LEFT_WIDTH_RATIO * 100}% is within 39–40%`
);
assert(
  PROPORTIONS.RIGHT_WIDTH_RATIO >= 0.39 && PROPORTIONS.RIGHT_WIDTH_RATIO <= 0.40,
  `Right region proportion ${PROPORTIONS.RIGHT_WIDTH_RATIO * 100}% is within 39–40%`
);
assert(
  PROPORTIONS.CENTRAL_EXCLUSION_RATIO >= 0.20 && PROPORTIONS.CENTRAL_EXCLUSION_RATIO <= 0.22,
  `Central negative space ${PROPORTIONS.CENTRAL_EXCLUSION_RATIO * 100}% is within 20–22%`
);
const sumProportions =
  PROPORTIONS.LEFT_WIDTH_RATIO +
  PROPORTIONS.CENTRAL_EXCLUSION_RATIO +
  PROPORTIONS.RIGHT_WIDTH_RATIO;
assert(
  Math.abs(sumProportions - 1.0) < 1e-6,
  `Proportions sum exactly to 1.00 (Actual: ${sumProportions})`
);

// --------------------------------------------------------------------------
// 2. Spatial Boundaries at Reference Frustum
// --------------------------------------------------------------------------
console.log('\n2. Computed Spatial Boundaries (3:1 Reference Frustum):');
const frustum = computeFrustumDimensions(1024, 341.333); // 3.0 aspect
const bounds = computeSpatialBounds(frustum.worldWidth, frustum.worldHeight);

console.log(`  Frustum world dimensions: ${bounds.worldWidth.toFixed(3)} x ${bounds.worldHeight.toFixed(3)}`);
console.log(`  Left region:  [${bounds.leftRegion.xMin.toFixed(3)}, ${bounds.leftRegion.xMax.toFixed(3)}] (Width: ${bounds.leftRegion.width.toFixed(3)})`);
console.log(`  Central gap:  [${bounds.centralExclusion.xMin.toFixed(3)}, ${bounds.centralExclusion.xMax.toFixed(3)}] (Width: ${bounds.centralExclusion.width.toFixed(3)})`);
console.log(`  Right region: [${bounds.rightRegion.xMin.toFixed(3)}, ${bounds.rightRegion.xMax.toFixed(3)}] (Width: ${bounds.rightRegion.width.toFixed(3)})`);

const leftRatio = bounds.leftRegion.width / bounds.worldWidth;
const centerRatio = bounds.centralExclusion.width / bounds.worldWidth;
const rightRatio = bounds.rightRegion.width / bounds.worldWidth;
const sumRegions = bounds.leftRegion.width + bounds.centralExclusion.width + bounds.rightRegion.width;

assert(
  leftRatio >= 0.39 && leftRatio <= 0.40,
  `Left region actual width is ${(leftRatio * 100).toFixed(2)}% of total width (Requirement: 39–40%)`
);
assert(
  rightRatio >= 0.39 && rightRatio <= 0.40,
  `Right region actual width is ${(rightRatio * 100).toFixed(2)}% of total width (Requirement: 39–40%)`
);
assert(
  centerRatio >= 0.20 && centerRatio <= 0.22,
  `Central exclusion actual width is ${(centerRatio * 100).toFixed(2)}% of total width (Requirement: 20–22%)`
);
assert(
  Math.abs(sumRegions - bounds.worldWidth) < 1e-4,
  `Sum of all three regions (${sumRegions.toFixed(3)}) exactly equals total world width (${bounds.worldWidth.toFixed(3)})`
);
assert(
  bounds.centralExclusion.xMin === -bounds.centralExclusion.xMax,
  'Central exclusion zone is perfectly centered at X = 0'
);
assert(
  Math.abs(bounds.leftRegion.xMax - bounds.centralExclusion.xMin) < 1e-6,
  'Left region abuts central exclusion boundary with zero gap and zero overlap'
);
assert(
  Math.abs(bounds.rightRegion.xMin - bounds.centralExclusion.xMax) < 1e-6,
  'Right region abuts central exclusion boundary with zero gap and zero overlap'
);
assert(
  bounds.leftRegion.xMinWithBleed < bounds.leftRegion.xMin,
  'Left region has outer bleed margin for natural edge run-off'
);
assert(
  bounds.rightRegion.xMaxWithBleed > bounds.rightRegion.xMax,
  'Right region has outer bleed margin for natural edge run-off'
);

// --------------------------------------------------------------------------
// 3. Central Exclusion Function & Boundary Probing
// --------------------------------------------------------------------------
console.log('\n3. Strict Central Exclusion Probing:');
const gapHalf = bounds.centralExclusion.xMax;
assert(isWithinCentralExclusion(0, gapHalf), 'Origin X = 0 is inside exclusion zone');
assert(isWithinCentralExclusion(gapHalf * 0.5, gapHalf), 'X = +0.5 * gap is inside exclusion zone');
assert(isWithinCentralExclusion(-gapHalf * 0.5, gapHalf), 'X = -0.5 * gap is inside exclusion zone');
assert(isWithinCentralExclusion(gapHalf * 0.999, gapHalf), 'X = +0.999 * gap is inside exclusion zone');
assert(isWithinCentralExclusion(-gapHalf * 0.999, gapHalf), 'X = -0.999 * gap is inside exclusion zone');
assert(!isWithinCentralExclusion(gapHalf, gapHalf), 'X = +1.0 * gap (boundary) is outside exclusion zone');
assert(!isWithinCentralExclusion(-gapHalf, gapHalf), 'X = -1.0 * gap (boundary) is outside exclusion zone');
assert(!isWithinCentralExclusion(gapHalf * 1.01, gapHalf), 'X = +1.01 * gap is outside exclusion zone');
assert(!isWithinCentralExclusion(-gapHalf * 1.01, gapHalf), 'X = -1.01 * gap is outside exclusion zone');
assert(!isWithinCentralExclusion(-10, bounds), 'Deep left formation X = -10 is outside exclusion zone (tested with bounds object)');
assert(!isWithinCentralExclusion(10, bounds), 'Deep right formation X = +10 is outside exclusion zone (tested with bounds object)');
assert(!isWithinCentralExclusion(NaN), 'Non-numeric NaN safely returns false');
assert(!isWithinCentralExclusion(undefined), 'Undefined safely returns false');

// --------------------------------------------------------------------------
// 4. clampToFormation Attack & Boundary Enforcement
// --------------------------------------------------------------------------
console.log('\n4. clampToFormation Stress & Side Isolation:');
// Critical attack: Point drifting into opposite territory with explicit side
const driftedLeftPoint = clampToFormation(1.5, 'left', bounds);
assert(
  driftedLeftPoint <= bounds.leftRegion.xMax,
  `clampToFormation(+1.5, 'left') clamped to ${driftedLeftPoint.toFixed(3)} <= ${bounds.leftRegion.xMax.toFixed(3)} (does not cross center)`
);
const farRightForLeft = clampToFormation(100.0, 'left', bounds);
assert(
  farRightForLeft === bounds.leftRegion.xMax,
  `clampToFormation(+100, 'left') clamped to leftRegion.xMax (${farRightForLeft.toFixed(3)})`
);
const farLeftForLeft = clampToFormation(-100.0, 'left', bounds);
assert(
  farLeftForLeft === bounds.leftRegion.xMin,
  `clampToFormation(-100, 'left') clamped to leftRegion.xMin (${farLeftForLeft.toFixed(3)})`
);

const driftedRightPoint = clampToFormation(-1.5, 'right', bounds);
assert(
  driftedRightPoint >= bounds.rightRegion.xMin,
  `clampToFormation(-1.5, 'right') clamped to ${driftedRightPoint.toFixed(3)} >= ${bounds.rightRegion.xMin.toFixed(3)} (does not cross center)`
);
const farLeftForRight = clampToFormation(-100.0, 'right', bounds);
assert(
  farLeftForRight === bounds.rightRegion.xMin,
  `clampToFormation(-100, 'right') clamped to rightRegion.xMin (${farLeftForRight.toFixed(3)})`
);
const farRightForRight = clampToFormation(100.0, 'right', bounds);
assert(
  farRightForRight === bounds.rightRegion.xMax,
  `clampToFormation(+100, 'right') clamped to rightRegion.xMax (${farRightForRight.toFixed(3)})`
);

// Auto-side handling
const autoOrigin = clampToFormation(0, 'auto', bounds);
assert(
  !isWithinCentralExclusion(autoOrigin, bounds),
  `clampToFormation(0, 'auto') (${autoOrigin.toFixed(3)}) is guaranteed outside central exclusion`
);
const autoPosDrift = clampToFormation(0.5, 'auto', bounds);
assert(
  autoPosDrift >= bounds.rightRegion.xMin,
  `clampToFormation(+0.5, 'auto') (${autoPosDrift.toFixed(3)}) clamped to right region`
);
const autoNegDrift = clampToFormation(-0.5, 'auto', bounds);
assert(
  autoNegDrift <= bounds.leftRegion.xMax,
  `clampToFormation(-0.5, 'auto') (${autoNegDrift.toFixed(3)}) clamped to left region`
);

// --------------------------------------------------------------------------
// 5. Section 8 Architectural Integration Slots
// --------------------------------------------------------------------------
console.log('\n5. Architectural Slots (Section 8 Requirements):');
const requiredSlots = [
  'PrimaryFilaments',
  'NeuralConnections',
  'NeuralNodes',
  'DepthLayers',
  'ParticleField',
  'NeuralWireMaterials',
  'AnimationController',
];

for (const slot of requiredSlots) {
  assert(
    ARCHITECTURAL_SLOTS.includes(slot),
    `Architectural slot '${slot}' is registered`
  );
}
assert(
  bounds.architecturalSlots.length === requiredSlots.length,
  `All ${requiredSlots.length} architectural slots verified in spatial bounds`
);

// --------------------------------------------------------------------------
// 6. Device Tiers and Responsive Camera Framing
// --------------------------------------------------------------------------
console.log('\n6. Responsive Tiers & Camera Framing:');
const testViewports = [
  { name: 'Ultrawide 3:1 (1024x341)', w: 1024, h: 341.333, expectedTier: RESPONSIVE_TIERS.ULTRAWIDE },
  { name: 'Ultrawide 21:9 (3440x1440)', w: 3440, h: 1440, expectedTier: RESPONSIVE_TIERS.ULTRAWIDE },
  { name: 'Standard Desktop 16:9 (1920x1080)', w: 1920, h: 1080, expectedTier: RESPONSIVE_TIERS.DESKTOP },
  { name: 'Standard Desktop 16:10 (1920x1200)', w: 1920, h: 1200, expectedTier: RESPONSIVE_TIERS.DESKTOP },
  { name: 'Tablet 4:3 (1024x768)', w: 1024, h: 768, expectedTier: RESPONSIVE_TIERS.TABLET },
  { name: 'Tablet 3:2 (1080x720)', w: 1080, h: 720, expectedTier: RESPONSIVE_TIERS.TABLET },
  { name: 'Mobile Portrait 9:16 (390x844)', w: 390, h: 844, expectedTier: RESPONSIVE_TIERS.MOBILE },
  { name: 'Extreme Ultrawide 32:9 (5120x1440)', w: 5120, h: 1440, expectedTier: RESPONSIVE_TIERS.ULTRAWIDE },
  { name: 'Extreme Mobile 1:3 (300x900)', w: 300, h: 900, expectedTier: RESPONSIVE_TIERS.MOBILE },
];

for (const vp of testViewports) {
  const aspect = vp.w / vp.h;
  const tier = getDeviceTier(aspect);
  assert(tier === vp.expectedTier, `${vp.name} correctly classified as tier '${tier}'`);

  const cam = computeResponsiveCamera(aspect);
  const responsiveWorldH = 2.0 * Math.tan((cam.fov * Math.PI / 180) * 0.5) * cam.cameraZ;
  const responsiveWorldW = responsiveWorldH * aspect;

  assert(
    responsiveWorldW >= bounds.worldWidth * 0.999,
    `  ${vp.name}: visible horizontal width ${responsiveWorldW.toFixed(2)} frames entire panoramic formation (min target: ${bounds.worldWidth.toFixed(2)})`
  );
  assert(
    cam.position[0] === 0 && cam.position[1] === 0 && cam.cameraZ >= DEFAULT_CAMERA_CONFIG.position[2],
    `  ${vp.name}: camera stays centered and pulls back along Z (cameraZ = ${cam.cameraZ.toFixed(2)})`
  );
}

// --------------------------------------------------------------------------
// 7. Defensive Input Handling & Fallbacks
// --------------------------------------------------------------------------
console.log('\n7. Defensive Edge Case Handling:');
const zeroFrustum = computeFrustumDimensions(0, 0);
assert(zeroFrustum.worldWidth > 0 && zeroFrustum.worldHeight > 0, 'computeFrustumDimensions(0, 0) falls back to positive dimensions');

const zeroCamera = computeResponsiveCamera(0);
assert(Number.isFinite(zeroCamera.cameraZ) && zeroCamera.cameraZ > 0, 'computeResponsiveCamera(0) safely handles zero aspect');

const nullBounds = computeSpatialBounds(null, null);
assert(nullBounds.worldWidth > 0 && nullBounds.leftRegion.width > 0, 'computeSpatialBounds(null, null) safely falls back to default');

const nanTier = getDeviceTier(NaN);
assert(nanTier === RESPONSIVE_TIERS.DESKTOP, 'getDeviceTier(NaN) safely returns default desktop tier');

assert(DEFAULT_SPATIAL_BOUNDS !== null && typeof DEFAULT_SPATIAL_BOUNDS === 'object', 'DEFAULT_SPATIAL_BOUNDS singleton is exported');

// --------------------------------------------------------------------------
// 8. Depth Range and Scene Constraints
// --------------------------------------------------------------------------
console.log('\n8. Depth & Spatial Constraints:');
assert(DEPTH_RANGE.min === -3.5 && DEPTH_RANGE.max === 3.5, 'Depth range is [-3.5, 3.5]');
assert(DEPTH_RANGE.span === 7.0, 'Depth range span is 7.0 units');
assert(DEFAULT_CAMERA_CONFIG.fov === 34, 'Camera FOV is 34 degrees');
assert(DEFAULT_CAMERA_CONFIG.position[2] === 16, 'Base camera Z is 16');

console.log('\n================================================================');
console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
