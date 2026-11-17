/**
 * SPATIAL CONFIGURATION & COORDINATE BOUNDARIES
 * 
 * Centralized spatial boundaries, coordinate system definitions,
 * camera framing math, architectural slots, and responsive tier definitions
 * for the 3D Neural Wireframe project.
 * 
 * Coordinate System:
 *   X axis: Horizontal progression (-X = Left formation, +X = Right formation, X ~ 0 = Central exclusion)
 *   Y axis: Vertical distribution   (symmetrical around Y = 0)
 *   Z axis: Spatial depth           (+Z toward camera, -Z receding into depth)
 * 
 * Target Panoramic Composition:
 *   Reference Aspect Ratio: 3.0:1 (based on reference image 1024x341, aspect 3.0029:1)
 *   Left geometry region:   39.5% of total width (within 39–40%)
 *   Central negative space: 21.0% of total width (within 20–22%)
 *   Right geometry region:  39.5% of total width (within 39–40%)
 *   Total:                  100.0% of total width
 */

export const REFERENCE_ASPECT_RATIO = 3.0;

export const PROPORTIONS = Object.freeze({
  LEFT_WIDTH_RATIO: 0.395,
  CENTRAL_EXCLUSION_RATIO: 0.210,
  RIGHT_WIDTH_RATIO: 0.395,
  VERTICAL_EXTENT_RATIO: 0.65, // formations span ~65% of viewport height at focal plane
});

export const DEFAULT_CAMERA_CONFIG = Object.freeze({
  fov: 34,
  position: Object.freeze([0, 0, 16]),
  target: Object.freeze([0, 0, 0]),
  near: 0.1,
  far: 100,
});

export const DEPTH_RANGE = Object.freeze({
  min: -3.5,
  max: 3.5,
  span: 7.0,
});

export const RESPONSIVE_TIERS = Object.freeze({
  ULTRAWIDE: 'ultrawide', // aspect >= 2.3
  DESKTOP:   'desktop',   // 1.55 <= aspect < 2.3
  TABLET:    'tablet',    // 0.90 <= aspect < 1.55
  MOBILE:    'mobile',    // aspect < 0.90
});

/**
 * Architectural integration slots required by Phase 1 (Section 8)
 * for upcoming procedural and visual components.
 */
export const ARCHITECTURAL_SLOTS = Object.freeze([
  'DepthLayers',
  'PrimaryFilaments',
  'NeuralConnections',
  'NeuralNodes',
  'ParticleField',
  'NeuralWireMaterials',
  'AnimationController',
]);

/**
 * Determine the responsive tier based on aspect ratio.
 * @param {number} aspect - width / height
 * @returns {string} One of RESPONSIVE_TIERS
 */
export function getDeviceTier(aspect) {
  const a = Number(aspect);
  if (!Number.isFinite(a) || a <= 0) return RESPONSIVE_TIERS.DESKTOP;
  if (a >= 2.3) return RESPONSIVE_TIERS.ULTRAWIDE;
  if (a >= 1.55) return RESPONSIVE_TIERS.DESKTOP;
  if (a >= 0.9) return RESPONSIVE_TIERS.TABLET;
  return RESPONSIVE_TIERS.MOBILE;
}

/**
 * Compute the visible 3D world frustum dimensions at focal plane Z = 0.
 * @param {number} [pixelWidth=1024] - viewport pixel width
 * @param {number} [pixelHeight=341] - viewport pixel height
 * @param {number} [fovDeg=34] - vertical field of view in degrees
 * @param {number} [cameraZ=16] - camera distance along Z
 * @returns {{ worldWidth: number, worldHeight: number, aspect: number }}
 */
export function computeFrustumDimensions(
  pixelWidth = 1024,
  pixelHeight = 341,
  fovDeg = DEFAULT_CAMERA_CONFIG.fov,
  cameraZ = DEFAULT_CAMERA_CONFIG.position[2]
) {
  const w = Math.max(Number(pixelWidth) || 1024, 1);
  const h = Math.max(Number(pixelHeight) || 341, 1);
  const aspect = w / h;
  const safeFov = Math.max(1, Math.min(170, Number(fovDeg) || DEFAULT_CAMERA_CONFIG.fov));
  const safeCameraZ = Math.max(0.1, Number(cameraZ) || DEFAULT_CAMERA_CONFIG.position[2]);
  const worldHeight = 2.0 * Math.tan((safeFov * Math.PI / 180) * 0.5) * safeCameraZ;
  const worldWidth = worldHeight * aspect;
  return { worldWidth, worldHeight, aspect };
}

/**
 * Compute the responsive camera configuration to preserve panoramic composition
 * without horizontal clipping or distortion across arbitrary aspect ratios.
 * @param {number} aspect - current viewport aspect ratio
 * @param {number} [baseFov=34]
 * @param {number} [baseCameraZ=16]
 * @returns {{ cameraZ: number, fov: number, position: number[], target: number[] }}
 */
export function computeResponsiveCamera(
  aspect,
  baseFov = DEFAULT_CAMERA_CONFIG.fov,
  baseCameraZ = DEFAULT_CAMERA_CONFIG.position[2]
) {
  const validAspect = Math.max(0.01, Number(aspect) || REFERENCE_ASPECT_RATIO);
  let cameraZ = baseCameraZ;
  // If viewport is narrower than reference 3:1 aspect ratio, pull the camera back along Z
  // so the entire horizontal composition (left wing, central void, right wing)
  // remains cleanly in view with consistent proportions and no fish-eye distortion.
  if (validAspect < REFERENCE_ASPECT_RATIO) {
    const scale = REFERENCE_ASPECT_RATIO / validAspect;
    cameraZ = baseCameraZ * scale;
  }
  return {
    cameraZ,
    fov: baseFov,
    position: [0, 0, cameraZ],
    target: [0, 0, 0],
  };
}

/**
 * Compute detailed 3D spatial boundaries for the left formation, right formation,
 * and central exclusion zone.
 * 
 * Boundaries strictly satisfy:
 *   - leftRegion.width = 39.5% of worldWidth
 *   - centralExclusion.width = 21.0% of worldWidth
 *   - rightRegion.width = 39.5% of worldWidth
 *   - leftRegion and centralExclusion are contiguous at X = -centralExclusionHalfWidth
 *   - centralExclusion and rightRegion are contiguous at X = +centralExclusionHalfWidth
 *   - Total span sums to 100% of visible worldWidth
 * 
 * @param {number} [worldWidth] - visible width in 3D units at Z=0 (defaults to reference width ~29.35)
 * @param {number} [worldHeight] - visible height in 3D units at Z=0 (defaults to reference height ~9.78)
 * @returns {object} Centralized spatial boundary specification
 */
export function computeSpatialBounds(worldWidth, worldHeight) {
  // Default to standard frustum at reference aspect ratio if not specified
  if (!worldWidth || !worldHeight || Number.isNaN(worldWidth) || Number.isNaN(worldHeight)) {
    const defaultFrustum = computeFrustumDimensions(1024, 341);
    worldWidth = defaultFrustum.worldWidth;
    worldHeight = defaultFrustum.worldHeight;
  }

  const aspect = worldWidth / Math.max(worldHeight, 0.001);
  const tier = getDeviceTier(aspect);

  // Proportional calculations:
  // Total span: worldWidth
  // Left: 39.5%, Central: 21.0%, Right: 39.5% -> Sum = 100.0%
  const halfWidth = worldWidth * 0.5;
  const centralExclusionHalfWidth = halfWidth * PROPORTIONS.CENTRAL_EXCLUSION_RATIO; // 21.0% of worldWidth / 2 = 10.5% of worldWidth
  const formationWidth = halfWidth - centralExclusionHalfWidth; // 39.5% of worldWidth

  // Optional 2% bleed run-off margin for procedural curve generation endpoints
  const outerBleedMargin = halfWidth * 0.02;

  const verticalExtent = (worldHeight * PROPORTIONS.VERTICAL_EXTENT_RATIO) * 0.5;

  return {
    referenceAspect: REFERENCE_ASPECT_RATIO,
    aspect,
    tier,
    worldWidth,
    worldHeight,
    halfWidth,

    // Proportional breakdown
    proportions: {
      leftWidthRatio: PROPORTIONS.LEFT_WIDTH_RATIO,
      centralExclusionRatio: PROPORTIONS.CENTRAL_EXCLUSION_RATIO,
      rightWidthRatio: PROPORTIONS.RIGHT_WIDTH_RATIO,
    },

    // Left formation region: [-halfWidth, -centralExclusionHalfWidth]
    // Exactly 39.5% of total visible worldWidth
    leftRegion: {
      xMin: -halfWidth,
      xMax: -centralExclusionHalfWidth,
      xMinWithBleed: -(halfWidth + outerBleedMargin),
      yMin: -verticalExtent,
      yMax: verticalExtent,
      zMin: DEPTH_RANGE.min,
      zMax: DEPTH_RANGE.max,
      width: formationWidth,
      height: verticalExtent * 2,
      depth: DEPTH_RANGE.span,
    },

    // Central exclusion zone: (-centralExclusionHalfWidth, centralExclusionHalfWidth)
    // Exactly 21.0% of total visible worldWidth
    // Must remain strictly empty with zero geometry!
    centralExclusion: {
      xMin: -centralExclusionHalfWidth,
      xMax: centralExclusionHalfWidth,
      yMin: -verticalExtent,
      yMax: verticalExtent,
      zMin: DEPTH_RANGE.min,
      zMax: DEPTH_RANGE.max,
      width: centralExclusionHalfWidth * 2,
      height: verticalExtent * 2,
      depth: DEPTH_RANGE.span,
    },

    // Right formation region: [centralExclusionHalfWidth, halfWidth]
    // Exactly 39.5% of total visible worldWidth
    rightRegion: {
      xMin: centralExclusionHalfWidth,
      xMax: halfWidth,
      xMaxWithBleed: halfWidth + outerBleedMargin,
      yMin: -verticalExtent,
      yMax: verticalExtent,
      zMin: DEPTH_RANGE.min,
      zMax: DEPTH_RANGE.max,
      width: formationWidth,
      height: verticalExtent * 2,
      depth: DEPTH_RANGE.span,
    },

    outerBleedMargin,
    verticalExtent,
    depthRange: DEPTH_RANGE,
    cameraConfig: DEFAULT_CAMERA_CONFIG,
    architecturalSlots: ARCHITECTURAL_SLOTS,
  };
}

/**
 * Pre-computed default spatial bounds singleton at reference 3:1 frustum.
 * Avoids per-call recalculations in high-frequency geometry code.
 */
export const DEFAULT_SPATIAL_BOUNDS = Object.freeze(computeSpatialBounds());

/**
 * Check whether a given X coordinate falls inside the central exclusion zone.
 * @param {number} x - 3D world X coordinate
 * @param {number|object} [innerGapHalfWidth] - half width of exclusion zone, or bounds object
 * @returns {boolean} True if inside exclusion zone (should NEVER contain geometry)
 */
export function isWithinCentralExclusion(x, innerGapHalfWidth) {
  if (typeof x !== 'number' || Number.isNaN(x)) return false;

  let gapHalf = innerGapHalfWidth;
  if (gapHalf === undefined) {
    gapHalf = DEFAULT_SPATIAL_BOUNDS.centralExclusion.xMax;
  } else if (typeof gapHalf === 'object' && gapHalf !== null && gapHalf.centralExclusion) {
    gapHalf = gapHalf.centralExclusion.xMax;
  }
  return Math.abs(x) < Number(gapHalf);
}

/**
 * Validate and clamp an X coordinate to ensure it never violates the central exclusion zone.
 * Strictly respects explicit formation side ('left' or 'right').
 * 
 * @param {number} x - input X coordinate
 * @param {'left'|'right'|'auto'} [side='auto'] - formation side
 * @param {object} [bounds=DEFAULT_SPATIAL_BOUNDS] - spatial bounds object
 * @returns {number} Clamped X coordinate guaranteed outside central exclusion
 */
export function clampToFormation(x, side = 'auto', bounds = DEFAULT_SPATIAL_BOUNDS) {
  const safeX = Number(x) || 0;
  let targetSide = side;

  if (targetSide !== 'left' && targetSide !== 'right') {
    targetSide = safeX >= 0 ? 'right' : 'left';
  }

  if (targetSide === 'right') {
    return Math.max(bounds.rightRegion.xMin, Math.min(bounds.rightRegion.xMax, safeX));
  }
  return Math.max(bounds.leftRegion.xMin, Math.min(bounds.leftRegion.xMax, safeX));
}
