import * as THREE from 'three';
import {
  computeSpatialBounds,
  clampToFormation,
  DEFAULT_SPATIAL_BOUNDS,
} from './spatialConfig.js';

/**
 * DEFAULT_SIDE_PARAMS
 * Calibrated deterministic parameters for left and right neural formations.
 * Ensures balanced visual weight, matching vertical/horizontal coverage,
 * and exact bilateral symmetry.
 */
export const DEFAULT_SIDE_PARAMS = Object.freeze({
  left: Object.freeze({
    seed: 20260501,
    particleSeed: 9021088,
    wavePhase0: 0.0,
    wavePhase1: 0.0,
    freqMod: 1.0,
    ampScale: 1.0,
    zPhaseShift: 0.0,
    zBiasMod: 0.0,
    nexusUs: Object.freeze([0.18, 0.44, 0.70, 0.86]),
    crestUs: Object.freeze([0.18, 0.70, 0.86]),
    strandPhases: Object.freeze([-0.20, 0.46, -0.50]),
    uWarpPhase: -0.23,
    cellDensityPeak: 0.44,
  }),
  right: Object.freeze({
    seed: 20260501,
    particleSeed: 9021088,
    wavePhase0: 0.0,
    wavePhase1: 0.0,
    freqMod: 1.0,
    ampScale: 1.0,
    zPhaseShift: 0.0,
    zBiasMod: 0.0,
    nexusUs: Object.freeze([0.18, 0.44, 0.70, 0.86]),
    crestUs: Object.freeze([0.18, 0.70, 0.86]),
    strandPhases: Object.freeze([-0.20, 0.46, -0.50]),
    uWarpPhase: -0.23,
    cellDensityPeak: 0.44,
  }),
});

/**
 * Resolves full side parameters by merging user options over defaults.
 * Supports passing either an options object or a legacy numeric customSeed.
 *
 * @param {string} [side='left']
 * @param {object|number|null} [options=null]
 * @returns {object} Resolved side parameters
 */
export function resolveSideParams(side = 'left', options = null) {
  const isRight = side === 'right';
  const defaults = isRight ? DEFAULT_SIDE_PARAMS.right : DEFAULT_SIDE_PARAMS.left;
  if (!options) return { ...defaults };
  if (typeof options === 'number') {
    return { ...defaults, seed: options };
  }
  const seed = options.seed ?? (typeof options.customSeed === 'number' ? options.customSeed : defaults.seed);
  return {
    ...defaults,
    ...options,
    seed,
  };
}

/**
 * Mulberry32 deterministic 32-bit PRNG.
 * Ensures consistent procedural geometry across renders and test runs.
 */
export function createSeededRandom(seed = 1337) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Computes responsive wireframe layout parameters strictly respecting spatialConfig.
 * Left formation in [-14.68, -3.08], Right formation in [3.08, 14.68], central exclusion |X| < 3.08.
 * 
 * @param {number} [viewportWidth=29.35]
 * @param {number} [viewportHeight=9.78]
 * @param {object} [customBounds=null]
 * @returns {object} Layout parameters
 */
export function computeResponsiveLayout(
  viewportWidth = 29.35,
  viewportHeight = 9.78,
  customBounds = null
) {
  const bounds = customBounds || computeSpatialBounds(viewportWidth, viewportHeight);
  const { tier, aspect, worldWidth, worldHeight } = bounds;

  // Strict central exclusion half width: exactly bounds.centralExclusion.xMax (~3.082 at 3:1)
  const innerGapHalfWidth = bounds.centralExclusion.xMax;
  // Outer extent: bounds.rightRegion.xMax (~14.675 at 3:1)
  const outerExtentX = bounds.rightRegion.xMax;
  const outerExtentXWithBleed = bounds.rightRegion.xMaxWithBleed;

  // Horizontal span from outer boundary to inner exclusion boundary
  const horizontalSpan = Math.max(outerExtentX - innerGapHalfWidth, 2.5);

  // Vertical scale based on spatialConfig verticalExtent
  const verticalScale = Math.min(bounds.verticalExtent, 3.4);

  const cycleScale = tier === 'mobile' ? 0.88 : tier === 'tablet' ? 0.94 : 1.0;
  const densityScale = tier === 'mobile' ? 0.70 : tier === 'tablet' ? 0.86 : 1.0;

  return {
    tier,
    aspect,
    viewportWidth: worldWidth,
    viewportHeight: worldHeight,
    bounds,
    innerGapHalfWidth,
    outerExtentX,
    outerExtentXWithBleed,
    horizontalSpan,
    verticalScale,
    cycleScale,
    densityScale,
  };
}

/**
 * Gaussian pulse evaluation helper.
 */
function gp(u, center, width) {
  const d = (u - center) / width;
  return Math.exp(-d * d);
}

/**
 * Evaluates the parametric ribbon surface at (u, v).
 * Symmetrically applies the proven organic wave equation to both Left and Right formations.
 * 
 * Strictly ensures X is clamped to Left [-14.68, -3.08] or Right [3.08, 14.68].
 */
export function evalSurface(u, v, desc, layerCfg, sideCfg, layout) {
  const { sideSign, isRight, side } = sideCfg;
  const { zBaseOffset, verticalSpreadScale, phaseShift, layerIndex } = layerCfg;
  const {
    streamId, streamV, sLocal, strandPhase,
    freq2, ampMod, zPhase, zBias, reachMod, fadeEndU, terminalYOffset, accentProfile,
    isPrimary, role, heroWeight = 0.85,
  } = desc;

  const uc = THREE.MathUtils.clamp(u, 0.0, 1.0);

  // ---- X (horizontal placement) -------------------------------------------
  const effSpan = layout.horizontalSpan * reachMod;
  const targetXMag = layout.outerExtentX - uc * effSpan;
  // Ensure float32 storage precision safety (+0.001) so Float32Array truncation never breaches gap
  const minXMag = layout.innerGapHalfWidth + 0.001;
  const rawXMag = Math.max(minXMag, Math.min(layout.outerExtentX, targetXMag));
  let x = sideSign * rawXMag;

  // Enforce spatial bounds clamp: guaranteed zero geometry in central exclusion zone
  x = clampToFormation(x, side, layout.bounds || DEFAULT_SPATIAL_BOUNDS);
  if (isRight) {
    x = Math.max(minXMag, x);
  } else {
    x = Math.min(-minXMag, x);
  }

  // ---- Envelopes ----------------------------------------------------------
  const outerFlare = 1.0 + 0.35 * Math.exp(-uc * 2.0);
  const innerTaper = 1.0 - 0.85 * Math.pow(THREE.MathUtils.smoothstep(uc, 0.60, 0.99), 1.4);
  const envelope   = outerFlare * innerTaper;
  const us         = uc * layout.cycleScale;
  const ph         = phaseShift * 0.22;

  const sideParams = sideCfg.sideParams || resolveSideParams(sideCfg.side || (isRight ? 'right' : 'left'));

  // Proximity metrics calibrated to wave crossing nexus & crests
  const nexusUs = sideParams.nexusUs || [0.18, 0.44, 0.70, 0.86];
  const pinchProx = nexusUs.reduce((mx, nu) => Math.max(mx, gp(uc, nu, 0.09)), 0.0);
  const crestUs   = sideParams.crestUs || [0.18, 0.70, 0.86];
  const crestProx = crestUs.reduce((mx, cu) => Math.max(mx, gp(uc, cu, 0.12)), 0.0);

  let ySheet = 0.0;

  // Analytical Harmonic Wave Formulation matching reference image media_1794905900958_72cc370e.jpg:
  // u = 0.00: upper entrance (Y > 0)
  // u = 0.18: first upper crest (Y ≈ +0.75)
  // u = 0.44: central crossing nexus (Y ≈ 0.0)
  // u = 0.70: deep lower trough (Y ≈ -0.55)
  // u = 0.86: second crest / almond loop (Y ≈ +0.28)
  // u = 1.00: smooth needle taper into central void (Y ≈ 0.0)
  const basePhase = us * Math.PI * 1.786 + 0.673;

  if (streamId === 0) {
    // Sheet 0 — main flowing optical ribbon
    const wave =
       0.58 * Math.sin(basePhase * sideParams.freqMod + ph + sideParams.wavePhase0)
      + 0.10 * Math.sin(basePhase * 2.0 * sideParams.freqMod - 0.30 + ph + sideParams.wavePhase0 * 1.2);
    const effStreamV = THREE.MathUtils.lerp(streamV, 0.5, THREE.MathUtils.smoothstep(uc, 0.65, 0.98) * 0.85);
    const vOffset = (effStreamV - 0.5) * 0.18;
    ySheet = (wave + vOffset) * envelope * sideParams.ampScale;

  } else if (streamId === 1) {
    // Sheet 1 — counter-braid flow weaving through Sheet 0 to create the signature almond loop
    const wave =
      -0.52 * Math.sin(basePhase * sideParams.freqMod + ph + sideParams.wavePhase1)
      + 0.12 * Math.cos(basePhase * 2.0 * sideParams.freqMod - 0.60 + ph + sideParams.wavePhase1 * 1.2);
    const effStreamV = THREE.MathUtils.lerp(streamV, 0.5, THREE.MathUtils.smoothstep(uc, 0.65, 0.98) * 0.85);
    const vOffset = (effStreamV - 0.5) * 0.18;
    ySheet = (wave + vOffset) * envelope * sideParams.ampScale;

  } else {
    // Sheet 2 — signature vibrant violet undulating ribbon and canopy tendrils
    if (accentProfile === 1) {
      // The lower undulating violet ribbon hugging the trough with brilliant purple glow
      const wave = -0.55 * Math.sin(basePhase * sideParams.freqMod + ph + sideParams.wavePhase0) - 0.12;
      ySheet = wave * envelope * sideParams.ampScale;
    } else if (accentProfile === 2) {
      const wave = 0.44 * Math.cos(basePhase * sideParams.freqMod - 0.40 + ph + sideParams.wavePhase1);
      ySheet = wave * envelope * sideParams.ampScale;
    } else {
      const cSign = sLocal >= 0 ? 1.0 : -1.0;
      ySheet = cSign * (0.45 * Math.exp(-uc * 1.70)
        + 0.16 * Math.cos(basePhase * 1.30 * sideParams.freqMod + strandPhase)) * innerTaper * sideParams.ampScale;
    }
  }

  // ---- Secondary ripple ---------------------------------------------------
  const ripple =
    Math.sin(us * Math.PI * (1.65 * freq2 * sideParams.freqMod) + strandPhase) *
    (0.078 + 0.055 * (1.0 - uc * 0.5)) *
    innerTaper * ampMod;

  // ---- Inner fan-out distribution -----------------------------------------
  const dist =
    THREE.MathUtils.smoothstep(uc, 0.60, 0.98) *
    terminalYOffset *
    (1.0 - 0.22 * THREE.MathUtils.smoothstep(uc, 0.90, 1.0));

  const y = (ySheet + ripple + dist) * layout.verticalScale * verticalSpreadScale;

  // ---- Z depth (front-to-back sheet weaving across layers) -----------------
  const depthSign = streamId === 0 ? 1.0 : streamId === 1 ? -1.0 : 0.5 * sLocal;
  const zPhaseEff = zPhase + sideParams.zPhaseShift;
  const zWeave =
    (depthSign * 0.85 * Math.sin(uc * Math.PI * 1.6 + zPhaseEff)
     + 0.44 * Math.cos(uc * Math.PI * 2.2 + strandPhase * 0.65)
     + sLocal * 0.50 + zBias + sideParams.zBiasMod) * innerTaper;
  const z = zBaseOffset + zWeave - layerIndex * 0.26 * uc;

  // ---- Edge fades ---------------------------------------------------------
  const outerFade   = THREE.MathUtils.smoothstep(uc, 0.0, 0.025);
  const fadeStart   = Math.max(0.85, fadeEndU - 0.12);
  const innerFade   = 1.0 - THREE.MathUtils.smoothstep(uc, fadeStart, fadeEndU);
  const edgeFade    = outerFade * Math.pow(innerFade, 1.1);

  return { x, y, z, u: uc, v, pinchProx, crestProx, edgeFade };
}

/**
 * Creates strand descriptors for one (layerIndex, isRight) combination.
 */
export function makeStrandDescriptors(layerIndex, isRight, densityScale, rng, sideParams = null) {
  const descs = [];

  const s0n = Math.max(5, Math.round((layerIndex === 0 ? 15 : layerIndex === 1 ? 11 : 8) * densityScale));
  const s1n = Math.max(5, Math.round((layerIndex === 0 ? 15 : layerIndex === 1 ? 11 : 8) * densityScale));
  const s2n = layerIndex === 0 ? 7 : layerIndex === 1 ? 5 : 4;

  const total = s0n + s1n + s2n;
  let gj = 0;

  const push = (streamId, count) => {
    for (let k = 0; k < count; k++) {
      const sv   = count > 1 ? k / (count - 1) : 0.5;
      const sLoc = sv * 2.0 - 1.0;
      const gv   = total > 1 ? gj / (total - 1) : 0.5;

      let role = 'secondary';
      let isPrimary = false;
      let accentProfile = 0;
      let heroWeight = 0.0;
      let isBeadCanopy = false;

      if (streamId === 0) {
        const idxA = Math.round((count - 1) * 0.82);
        const idxB = Math.round((count - 1) * 0.50);
        const idxC = Math.round((count - 1) * 0.20);
        if (layerIndex <= 1 && (k === idxA || k === idxB || (layerIndex === 0 && k === idxC))) {
          role = 'primary';
          isPrimary = true;
          heroWeight = k === idxA ? 1.0 : k === idxB ? 0.90 : 0.82;
        }
      } else if (streamId === 1) {
        const idxD = Math.round((count - 1) * 0.82);
        const idxE = Math.round((count - 1) * 0.22);
        if (layerIndex <= 1 && (k === idxD || (layerIndex === 0 && k === idxE))) {
          role = 'primary';
          isPrimary = true;
          heroWeight = k === idxD ? 0.95 : 0.84;
        }
      } else {
        if (k === 0) {
          role = 'accent';
          accentProfile = 1;
          isPrimary = false;
          heroWeight = 0.92;
        } else if (k === 1) {
          role = 'accent';
          accentProfile = 2;
          isPrimary = false;
          heroWeight = 0.88;
        } else {
          role = 'canopy';
          accentProfile = 3;
          isBeadCanopy = k === 2 || k === count - 1;
        }
      }

      const effSLocal = (streamId === 2 && k >= 2)
        ? (count > 3 ? (k - 2) / (count - 3) * 2.0 - 1.0 : (k === 2 ? 1.0 : -1.0))
        : sLoc;

      const strandPhases = sideParams?.strandPhases || [-0.20, 0.46, -0.50];
      const basePhase =
        streamId === 0 ? strandPhases[0]
        : streamId === 1 ? strandPhases[1]
        : strandPhases[2];

      const strandPhase = basePhase + effSLocal * 0.60 + (rng() - 0.5) * 0.12;
      const freq2       = 0.90 + 0.18 * sv + (rng() - 0.5) * 0.06;
      const ampMod      = 0.88 + 0.24 * Math.sin(sv * Math.PI);
      const zPhase      = streamId * 1.06 + sv * 0.95 + (rng() - 0.5) * 0.18;
      const zBias       = (sv - 0.5) * 0.40 + (rng() - 0.5) * 0.14;

      const reachMod = isPrimary ? 0.98 + 0.02 * rng()
        : role === 'canopy' ? 0.88 + 0.10 * rng()
        : 0.92 + 0.07 * sv + 0.01 * rng();

      const fadeEndU = isPrimary ? 0.98 + 0.02 * rng()
        : role === 'canopy' ? 0.88 + 0.10 * rng()
        : 0.92 + 0.07 * sv + 0.01 * rng();

      const terminalYOffset =
        (streamId === 0 ? 0.05 : streamId === 1 ? -0.05 : 0.0)
        + effSLocal * 0.12 + (rng() - 0.5) * 0.04;

      descs.push({
        strandIndex: gj, streamId, streamIndex: k, streamCount: count,
        streamV: sv, sLocal: effSLocal, v: gv,
        role, accentProfile, isPrimary, isBeadCanopy, heroWeight,
        strandPhase, freq2, ampMod, zPhase, zBias,
        reachMod, fadeEndU, terminalYOffset,
      });
      gj++;
    }
  };

  push(0, s0n);
  push(1, s1n);
  push(2, s2n);
  return descs;
}

/**
 * Computes per-vertex color weights and alpha.
 */
export function vertexAppearance(pt, desc, layerIndex, wireType = 'filament', densityBoost = 0.0) {
  const { pinchProx, crestProx, edgeFade } = pt;
  const { role, accentProfile, isPrimary, heroWeight } = desc;

  let wPrimary = 0.0, wSecondary = 0.0, wAccent = 0.0, wHighlight = 0.0;
  let alpha = edgeFade;

  if (wireType === 'connection') {
    const isAccentZone = role === 'accent' || gp(pt.u, 0.70, 0.15) > 0.55;

    if (isAccentZone && role === 'accent') {
      wPrimary   = 0.15;
      wSecondary = 0.35;
      wAccent    = 0.35;
      wHighlight = 0.04 * pinchProx;
      alpha     *= layerIndex === 0 ? 0.26 : 0.18;
    } else {
      wPrimary   = layerIndex === 0 ? 0.72 : 0.52;
      wSecondary = 0.35;
      wAccent    = 0.0;
      wHighlight = 0.06 * pinchProx;
      alpha     *= (layerIndex === 0 ? 0.24 : layerIndex === 1 ? 0.17 : 0.12) + densityBoost * 0.05;
    }

  } else {
    // Filament
    if (isPrimary) {
      wPrimary   = 0.95;
      wSecondary = 0.18;
      wAccent    = 0.0;
      wHighlight = (
        0.82 * Math.pow(pinchProx, 1.8) +
        0.16 * heroWeight
      );
      alpha *= 0.98;

    } else if (role === 'accent') {
      const isVioletCore = accentProfile === 1;
      wPrimary   = isVioletCore ? 0.02 : 0.18;
      wSecondary = isVioletCore ? 0.10 : 0.25;
      wAccent    = isVioletCore ? 1.00 : 0.85;
      wHighlight = isVioletCore ? (0.20 * pinchProx + 0.10 * crestProx) : 0.08 * pinchProx;
      alpha     *= 0.98;

    } else if (role === 'canopy') {
      wPrimary   = 0.32;
      wSecondary = 0.85;
      wAccent    = 0.25;
      wHighlight = 0.06 * pinchProx;
      alpha     *= 0.32;

    } else {
      const isFaintViolet = desc.streamIndex % 4 === 1;
      wPrimary   = isFaintViolet ? 0.12 : (layerIndex === 0 ? 0.55 + 0.20 * pinchProx : 0.35);
      wSecondary = isFaintViolet ? 0.50 : (layerIndex === 0 ? 0.85 : 0.88);
      wAccent    = isFaintViolet ? Math.min(0.60 * Math.sin(pt.u * Math.PI), 0.35) : 0.0;
      wHighlight = layerIndex === 0 ? 0.12 * Math.pow(pinchProx, 1.6) : 0.04 * pinchProx;
      alpha     *= layerIndex === 0 ? 0.52 + 0.22 * pinchProx : layerIndex === 1 ? 0.36 : 0.26;
    }
  }

  return {
    weights: [wPrimary, wSecondary, wAccent, wHighlight],
    alpha: THREE.MathUtils.clamp(alpha, 0.0, 1.0),
  };
}

function pushSegment(buf, vA, vB, appA, appB) {
  buf.positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
  buf.basePositions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
  buf.colorWeights.push(...appA.weights, ...appB.weights);
  buf.alphas.push(appA.alpha, appB.alpha);
  buf.uvParams.push(vA.u, vA.v ?? 0, vB.u, vB.v ?? 0);
  buf.metas.push(
    vA.sideSign  ?? 0, vA.layerIndex ?? 0, vA.strandIndex ?? 0, vA.pinchProx ?? 0,
    vB.sideSign  ?? 0, vB.layerIndex ?? 0, vB.strandIndex ?? 0, vB.pinchProx ?? 0
  );
}

function pushNode(nd, v, weights, alpha, size, tier) {
  nd.positions.push(v.x, v.y, v.z);
  nd.basePositions.push(v.x, v.y, v.z);
  nd.colorWeights.push(...weights);
  nd.alphas.push(alpha);
  nd.sizes.push(size);
  nd.tiers.push(tier);
  nd.uvParams.push(v.u ?? 0, v.v ?? 0);
  nd.metas.push(v.sideSign ?? 0, v.layerIndex ?? 0, v.strandIndex ?? 0, v.pinchProx ?? 0);
}

function buildLineGeo(buf) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',      new THREE.Float32BufferAttribute(buf.positions, 3));
  geo.setAttribute('aBasePosition', new THREE.Float32BufferAttribute(buf.basePositions, 3));
  geo.setAttribute('aColorWeights', new THREE.Float32BufferAttribute(buf.colorWeights, 4));
  geo.setAttribute('aAlpha',        new THREE.Float32BufferAttribute(buf.alphas, 1));
  geo.setAttribute('aUvParam',      new THREE.Float32BufferAttribute(buf.uvParams, 2));
  geo.setAttribute('aMeta',         new THREE.Float32BufferAttribute(buf.metas, 4));
  geo.computeBoundingSphere();
  return geo;
}

function emptyBuf() {
  return { positions: [], basePositions: [], colorWeights: [], alphas: [], uvParams: [], metas: [] };
}

export class NeuralGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.adjacency = new Map();
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, new Set());
    }
    return node;
  }

  hasEdge(idA, idB) {
    const adj = this.adjacency.get(idA);
    return adj ? adj.has(idB) : false;
  }

  addEdge(nodeA, nodeB, edgeType = 'secondary', extra = {}) {
    if (!nodeA || !nodeB || nodeA.id === nodeB.id) return null;
    if (this.hasEdge(nodeA.id, nodeB.id)) return null;

    const edge = {
      id: `e_${nodeA.id}_${nodeB.id}`,
      nodeA,
      nodeB,
      edgeType,
      layerIndex: extra.layerIndex ?? nodeA.layerIndex ?? 0,
      ...extra,
    };
    this.edges.push(edge);
    this.adjacency.get(nodeA.id).add(nodeB.id);
    this.adjacency.get(nodeB.id).add(nodeA.id);
    nodeA.degree = (nodeA.degree || 0) + 1;
    nodeB.degree = (nodeB.degree || 0) + 1;
    nodeA.neighbors.push(nodeB.id);
    nodeB.neighbors.push(nodeA.id);
    nodeA.edges.push(edge.id);
    nodeB.edges.push(edge.id);
    return edge;
  }
}

export function segmentsCross3D(p1, p2, p3, p4, zThreshold = 0.25) {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;

  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-6) return false;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const s = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

  if (t > 0.06 && t < 0.94 && s > 0.06 && s < 0.94) {
    const zA = (p1.z ?? 0) + t * ((p2.z ?? 0) - (p1.z ?? 0));
    const zB = (p3.z ?? 0) + s * ((p4.z ?? 0) - (p3.z ?? 0));
    return Math.abs(zA - zB) < zThreshold;
  }
  return false;
}

export function segmentsCross2D(p1, p2, p3, p4) {
  return segmentsCross3D(p1, p2, p3, p4, 0.25);
}

function buildNodeGeo(nd) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',      new THREE.Float32BufferAttribute(nd.positions, 3));
  geo.setAttribute('aBasePosition', new THREE.Float32BufferAttribute(nd.basePositions, 3));
  geo.setAttribute('aColorWeights', new THREE.Float32BufferAttribute(nd.colorWeights, 4));
  geo.setAttribute('aAlpha',        new THREE.Float32BufferAttribute(nd.alphas, 1));
  geo.setAttribute('aNodeSize',     new THREE.Float32BufferAttribute(nd.sizes, 1));
  geo.setAttribute('aNodeTier',     new THREE.Float32BufferAttribute(nd.tiers, 1));
  geo.setAttribute('aUvParam',      new THREE.Float32BufferAttribute(nd.uvParams, 2));
  geo.setAttribute('aMeta',         new THREE.Float32BufferAttribute(nd.metas, 4));
  geo.computeBoundingSphere();
  return geo;
}

export function mergeLineGeometries(geoA, geoB) {
  const merged = new THREE.BufferGeometry();
  const attrNames = ['position', 'aBasePosition', 'aColorWeights', 'aAlpha', 'aUvParam', 'aMeta'];
  for (const name of attrNames) {
    const a = geoA.getAttribute(name);
    const b = geoB.getAttribute(name);
    if (!a || !b) continue;
    const combined = new Float32Array(a.array.length + b.array.length);
    combined.set(a.array, 0);
    combined.set(b.array, a.array.length);
    merged.setAttribute(name, new THREE.BufferAttribute(combined, a.itemSize));
  }
  merged.computeBoundingSphere();
  return merged;
}

export function mergeNodeGeometries(geoA, geoB) {
  const merged = new THREE.BufferGeometry();
  const attrNames = ['position', 'aBasePosition', 'aColorWeights', 'aAlpha', 'aNodeSize', 'aNodeTier', 'aUvParam', 'aMeta'];
  for (const name of attrNames) {
    const a = geoA.getAttribute(name);
    const b = geoB.getAttribute(name);
    if (!a || !b) continue;
    const combined = new Float32Array(a.array.length + b.array.length);
    combined.set(a.array, 0);
    combined.set(b.array, a.array.length);
    merged.setAttribute(name, new THREE.BufferAttribute(combined, a.itemSize));
  }
  merged.computeBoundingSphere();
  return merged;
}

export function mergeParticleGeometries(geoA, geoB) {
  const merged = new THREE.BufferGeometry();
  const attrNames = ['position', 'aBasePosition', 'aColorWeights', 'aAlpha', 'aParticleSize', 'aUvParam'];
  for (const name of attrNames) {
    const a = geoA.getAttribute(name);
    const b = geoB.getAttribute(name);
    if (!a || !b) continue;
    const combined = new Float32Array(a.array.length + b.array.length);
    combined.set(a.array, 0);
    combined.set(b.array, a.array.length);
    merged.setAttribute(name, new THREE.BufferAttribute(combined, a.itemSize));
  }
  merged.computeBoundingSphere();
  return merged;
}

export function mergeGraphs(gA, gB) {
  const g = new NeuralGraph();
  if (gA) {
    for (const [id, node] of gA.nodes) g.nodes.set(id, node);
    for (const [id, adj] of gA.adjacency) g.adjacency.set(id, new Set(adj));
    g.edges.push(...gA.edges);
  }
  if (gB) {
    for (const [id, node] of gB.nodes) g.nodes.set(id, node);
    for (const [id, adj] of gB.adjacency) g.adjacency.set(id, new Set(adj));
    g.edges.push(...gB.edges);
  }
  return g;
}

/**
 * Generates procedural neural wireframe geometries for a single side formation
 * ('left' or 'right') respecting spatialConfig.
 * 
 * @param {string} [side='left'] - 'left' or 'right'
 * @param {object} layout - Layout parameters from computeResponsiveLayout
 * @param {object|number|null} [options=null] - Optional configuration overrides or seed
 * @returns {object} Geometries, canonical vertices, and graph for this side
 */
export function generateSideGeometry(side = 'left', layout, options = null) {
  const bounds = layout.bounds || DEFAULT_SPATIAL_BOUNDS;
  const minXMag = layout.innerGapHalfWidth + 0.001;
  const isRight = side === 'right';
  const sideSign = isRight ? 1 : -1;
  const sideParams = resolveSideParams(side, options);
  const seed = sideParams.seed;

  const sideCfg = { side, sideSign, isRight, seed, sideParams };
  const rng = createSeededRandom(seed);

  const layerCfgs = [
    { layerIndex: 0, numU: Math.round(58 * layout.densityScale), subSteps: 4,
      zBaseOffset: 0.28,  verticalSpreadScale: 0.76, phaseShift: 0.00 },
    { layerIndex: 1, numU: Math.round(44 * layout.densityScale), subSteps: 2,
      zBaseOffset: -0.78, verticalSpreadScale: 0.86, phaseShift: 0.76 },
    { layerIndex: 2, numU: Math.round(30 * layout.densityScale), subSteps: 2,
      zBaseOffset: -2.55, verticalSpreadScale: 1.05, phaseShift: -1.02 },
  ];

  const primaryBuf  = emptyBuf();
  const filamentBuf = emptyBuf();
  const meshBuf     = emptyBuf();
  const deepBuf     = emptyBuf();

  const nodeData = {
    positions: [], basePositions: [], colorWeights: [],
    alphas: [], sizes: [], tiers: [], uvParams: [], metas: [],
  };

  const canonicalVertices = [];
  const graph = new NeuralGraph();

  layerCfgs.forEach((layerCfg) => {
    const { layerIndex, numU, subSteps } = layerCfg;

    const descs = makeStrandDescriptors(layerIndex, sideCfg.isRight, layout.densityScale, rng, sideParams);
    const numV  = descs.length;

    // 1. Build canonical vertex grid & nodes
    const layerNodes = [];
    const grid = Array.from({ length: numU }, () => new Array(numV));

    for (let i = 0; i < numU; i++) {
      const uLin = i / (numU - 1);
      const uWarpPhase = sideParams.uWarpPhase ?? -0.23;
      const uWarp = uLin - 0.016 * Math.sin(uLin * Math.PI * 2.4 + uWarpPhase);

      for (let j = 0; j < numV; j++) {
        const desc = descs[j];
        const stagger = ((j % 2) - 0.5) * 0.20;
        const uEff = i > 0 && i < numU - 1
          ? THREE.MathUtils.clamp(uWarp + stagger / (numU - 1), 0.002, 0.998)
          : THREE.MathUtils.clamp(uLin, 0.0, 1.0);

        const pt = evalSurface(uEff, desc.v, desc, layerCfg, sideCfg, layout);
        const nodeId = `n_${sideCfg.side}_L${layerIndex}_u${i}_v${j}`;
        const vr = {
          ...pt,
          id: nodeId,
          uIndex: i, vIndex: j, strandIndex: j,
          layerIndex, sideSign: sideCfg.sideSign,
          isRight: sideCfg.isRight,
          streamId: desc.streamId,
          descriptor: desc,
          degree: 0,
          heroJunction: desc.isPrimary ? 1 : 0,
          tier: 0,
          size: 0.16 + 0.06 * rng(),
          alpha: pt.edgeFade * (0.80 + 0.16 * rng()),
          colorWeights: [0.80, 0.20, 0.0, 0.1],
          neighbors: [],
          edges: [],
        };
        grid[i][j] = vr;
        graph.addNode(vr);
        layerNodes.push(vr);
      }
    }

    // Spatial search bins along u
    const numBins = 36;
    const bins = Array.from({ length: numBins }, () => []);
    for (const node of layerNodes) {
      const bIdx = THREE.MathUtils.clamp(Math.floor(node.u * numBins), 0, numBins - 1);
      bins[bIdx].push(node);
    }

    const edgeBins = Array.from({ length: numBins }, () => []);

    function registerEdge(edge) {
      if (!edge) return;
      const minU = Math.min(edge.nodeA.u, edge.nodeB.u);
      const maxU = Math.max(edge.nodeA.u, edge.nodeB.u);
      const b0 = THREE.MathUtils.clamp(Math.floor(minU * numBins), 0, numBins - 1);
      const b1 = THREE.MathUtils.clamp(Math.floor(maxU * numBins), 0, numBins - 1);
      for (let b = b0; b <= b1; b++) {
        edgeBins[b].push(edge);
      }
    }

    // 2. Primary Hero Pathways (Catmull-Rom splines)
    for (let j = 0; j < numV; j++) {
      const desc = descs[j];
      if (!desc.isPrimary || layerIndex > 1) continue;

      const ctrlPts = [];
      for (let i = 0; i < numU; i++) {
        const gv = grid[i][j];
        ctrlPts.push(new THREE.Vector3(gv.x, gv.y, gv.z));
      }

      const curve = new THREE.CatmullRomCurve3(ctrlPts, false, 'centripetal', 0.5);
      const nSamples = (numU - 1) * subSteps;
      let prevV = null, prevApp = null;

      for (let s = 0; s <= nSamples; s++) {
        const exactI = s % subSteps === 0 ? s / subSteps : -1;
        let sv;

        if (exactI >= 0 && exactI < numU) {
          sv = grid[exactI][j];
          if (exactI > 0) {
            const prevNode = grid[exactI - 1][j];
            const edge = graph.addEdge(prevNode, sv, 'primary', { layerIndex });
            registerEdge(edge);
          }
        } else {
          const t = s / nSamples;
          const pt = curve.getPoint(t);
          pt.x = clampToFormation(pt.x, sideCfg.side, bounds);
          if (sideCfg.isRight) {
            pt.x = Math.max(minXMag, pt.x);
          } else {
            pt.x = Math.min(-minXMag, pt.x);
          }

          const iF = Math.floor(t * (numU - 1));
          const iC = Math.min(numU - 1, iF + 1);
          const fr = t * (numU - 1) - iF;
          const v0 = grid[iF][j];
          const v1 = grid[iC][j];
          const uI = THREE.MathUtils.lerp(v0.u, v1.u, fr);
          const sm = evalSurface(uI, desc.v, desc, layerCfg, sideCfg, layout);
          sv = {
            x: pt.x, y: pt.y, z: pt.z, u: uI, v: desc.v,
            pinchProx: sm.pinchProx, crestProx: sm.crestProx, edgeFade: sm.edgeFade,
            sideSign: sideCfg.sideSign, layerIndex, strandIndex: j,
          };
        }

        const app = vertexAppearance(sv, desc, layerIndex, 'filament');
        if (prevV) {
          pushSegment(primaryBuf, prevV, sv, prevApp, app);

          // Dynamic multi-strand optical-fiber sheath:
          // Bundles 6 flanking micro-strands that smoothly pinch tight at nexus junctions
          // and breathe open into silky threads at wave crests.
          const uMid = (sv.u + prevV.u) * 0.5;
          const pinchMid = (sv.pinchProx + prevV.pinchProx) * 0.5;
          const crestMid = (sv.crestProx + prevV.crestProx) * 0.5;
          const ribbonWidth = (0.016 + 0.014 * Math.sin(uMid * Math.PI)) * (1.0 - 0.65 * pinchMid) * (0.85 + 0.35 * crestMid) * layout.verticalScale;

          const offsets = [-0.90, -0.65, -0.40, -0.18, 0.18, 0.40, 0.65, 0.90];
          for (let oi = 0; oi < offsets.length; oi++) {
            const t = offsets[oi];
            const tAbs = Math.abs(t);
            const dy = t * ribbonWidth;
            const dz = t * 0.40 * ribbonWidth;

            const falloff = Math.exp(-tAbs * tAbs * 1.8);
            const wHigh = tAbs < 0.35 ? app.weights[3] * 0.35 : 0.02;
            const appSh = {
              weights: [app.weights[0] * 0.92, 0.22 + 0.32 * tAbs, 0.0, wHigh],
              alpha: app.alpha * falloff * 0.84,
            };
            const prevAppSh = {
              weights: [prevApp.weights[0] * 0.92, 0.22 + 0.32 * tAbs, 0.0, wHigh],
              alpha: prevApp.alpha * falloff * 0.84,
            };

            const svSh = { ...sv, y: sv.y + dy, z: sv.z + dz };
            const prevVSh = { ...prevV, y: prevV.y + dy, z: prevV.z + dz };
            pushSegment(primaryBuf, prevVSh, svSh, prevAppSh, appSh);
          }
        }
        prevV = sv;
        prevApp = app;
      }
    }

    // 3. Secondary Flow & Branching Connections
    for (let j = 0; j < numV; j++) {
      const desc = descs[j];
      if (desc.isPrimary && layerIndex <= 1) continue;

      const filBuf = layerIndex === 2 ? deepBuf : filamentBuf;

      const ctrlPts = [];
      for (let i = 0; i < numU; i++) {
        const gv = grid[i][j];
        ctrlPts.push(new THREE.Vector3(gv.x, gv.y, gv.z));
      }

      const curve = new THREE.CatmullRomCurve3(ctrlPts, false, 'centripetal', 0.5);
      const secSubSteps = layerIndex === 0 ? 2 : 1;
      const nSamples = (numU - 1) * secSubSteps;
      let prevV = null, prevApp = null;

      for (let s = 0; s <= nSamples; s++) {
        const exactI = s % secSubSteps === 0 ? s / secSubSteps : -1;
        let sv;

        if (exactI >= 0 && exactI < numU) {
          sv = grid[exactI][j];
          if (exactI > 0 && rng() < 0.88) {
            const prevNode = grid[exactI - 1][j];
            const edgeType = desc.role === 'accent' ? 'accent' : 'secondary';
            const edge = graph.addEdge(prevNode, sv, edgeType, { layerIndex });
            registerEdge(edge);
          }
        } else {
          const t = s / nSamples;
          const pt = curve.getPoint(t);
          pt.x = clampToFormation(pt.x, sideCfg.side, bounds);
          if (sideCfg.isRight) {
            pt.x = Math.max(minXMag, pt.x);
          } else {
            pt.x = Math.min(-minXMag, pt.x);
          }

          const iF = Math.floor(t * (numU - 1));
          const iC = Math.min(numU - 1, iF + 1);
          const fr = t * (numU - 1) - iF;
          const v0 = grid[iF][j];
          const v1 = grid[iC][j];
          const uI = THREE.MathUtils.lerp(v0.u, v1.u, fr);
          const sm = evalSurface(uI, desc.v, desc, layerCfg, sideCfg, layout);
          sv = {
            x: pt.x, y: pt.y, z: pt.z, u: uI, v: desc.v,
            pinchProx: sm.pinchProx, crestProx: sm.crestProx, edgeFade: sm.edgeFade,
            sideSign: sideCfg.sideSign, layerIndex, strandIndex: j,
          };
        }

        const app = vertexAppearance(sv, desc, layerIndex, 'filament');
        if (prevV && sv.edgeFade > 0.02) {
          pushSegment(filBuf, prevV, sv, prevApp, app);

          if (desc.role === 'accent') {
            // Luminous multi-strand electric royal violet ribbon bundle
            const isProfile1 = desc.accentProfile === 1;
            const uMid = (sv.u + prevV.u) * 0.5;
            const pinchMid = (sv.pinchProx + prevV.pinchProx) * 0.5;
            const ribbonWidth = (isProfile1 ? 0.024 + 0.014 * Math.sin(uMid * Math.PI) : 0.016 + 0.010 * Math.sin(uMid * Math.PI)) * (1.0 - 0.45 * pinchMid) * layout.verticalScale;

            const accentOffsets = isProfile1
              ? [-0.90, -0.60, -0.30, 0.30, 0.60, 0.90]
              : [-0.60, -0.25, 0.25, 0.60];

            for (let oi = 0; oi < accentOffsets.length; oi++) {
              const t = accentOffsets[oi];
              const tAbs = Math.abs(t);
              const dy = t * ribbonWidth;
              const dz = t * 0.35 * ribbonWidth;

              const falloff = Math.exp(-tAbs * tAbs * 1.5);
              const wHigh = tAbs < 0.35 ? 0.28 : 0.02;
              const appAccentSh = {
                weights: [0.02, 0.12, Math.min(1.0, app.weights[2] * 1.18), wHigh],
                alpha: app.alpha * falloff * (isProfile1 ? 0.95 : 0.80),
              };
              const prevAppAccentSh = {
                weights: [0.02, 0.12, Math.min(1.0, prevApp.weights[2] * 1.18), wHigh],
                alpha: prevApp.alpha * falloff * (isProfile1 ? 0.95 : 0.80),
              };

              const svVio = { ...sv, y: sv.y + dy, z: sv.z + dz };
              const prevVVio = { ...prevV, y: prevV.y + dy, z: prevV.z + dz };
              pushSegment(filBuf, prevVVio, svVio, prevAppAccentSh, appAccentSh);
            }
          }
        }
        prevV = sv;
        prevApp = app;
      }

      // Branching tendril connections to adjacent lanes
      for (let i = 0; i < numU - 1; i++) {
        const vA = grid[i][j];
        if (!vA || vA.edgeFade <= 0.04) continue;

        if (rng() < 0.28) {
          const targetJ = j + (rng() < 0.5 ? 1 : -1);
          if (targetJ >= 0 && targetJ < numV) {
            const vTarget = grid[i + 1][targetJ];
            if (vTarget && vTarget.descriptor.streamId === desc.streamId && vTarget.edgeFade > 0.04) {
              const dy = Math.abs(vA.y - vTarget.y);
              const dx = Math.abs(vA.x - vTarget.x);
              if (dy > 0.35 * layout.verticalScale || dy / (dx + 0.001) > 1.20) continue;

              const edge = graph.addEdge(vA, vTarget, 'secondary', { layerIndex });
              if (edge) {
                registerEdge(edge);
                const aA = vertexAppearance(vA, desc, layerIndex, 'filament');
                const aB = vertexAppearance(vTarget, vTarget.descriptor, layerIndex, 'filament');
                pushSegment(filBuf, vA, vTarget, aA, aB);
              }
            }
          }
        }
      }
    }

    // 4. Irregular Triangulation & Polygonal Cells
    const connBuf = layerIndex === 2 ? deepBuf : meshBuf;
    const minEdgeDist = 0.045 * layout.verticalScale;

    function canConnect3D(nA, nB) {
      const minU = Math.min(nA.u, nB.u);
      const maxU = Math.max(nA.u, nB.u);
      const b0 = THREE.MathUtils.clamp(Math.floor(minU * numBins), 0, numBins - 1);
      const b1 = THREE.MathUtils.clamp(Math.floor(maxU * numBins), 0, numBins - 1);

      for (let b = b0; b <= b1; b++) {
        for (const existingEdge of edgeBins[b]) {
          const eA = existingEdge.nodeA;
          const eB = existingEdge.nodeB;
          if (eA.id === nA.id || eA.id === nB.id || eB.id === nA.id || eB.id === nB.id) continue;
          if (segmentsCross3D(nA, nB, eA, eB, 0.25)) {
            return false;
          }
        }
      }
      return true;
    }
    const canConnect2D = canConnect3D;

    function addGraphConnection(vA, vB, edgeType = 'mesh', dBoost = 0.0) {
      if (!vA || !vB || vA.id === vB.id) return false;
      if (graph.hasEdge(vA.id, vB.id)) return false;

      const dx = Math.abs(vA.x - vB.x);
      const dy = Math.abs(vA.y - vB.y);
      const dz = Math.abs(vA.z - vB.z);
      const dist = Math.hypot(dx, dy, dz * 0.45);

      const flareEnv = 1.0 - 0.42 * Math.exp(-vA.u * 2.2);
      const maxEdgeDist = (layerIndex === 0 ? 0.88 : layerIndex === 1 ? 1.05 : 1.25) * layout.verticalScale * flareEnv;
      const maxSlope = 1.35;

      if (dx < 0.02 || dy / (dx + 0.001) > maxSlope || dist > maxEdgeDist || dist < minEdgeDist) {
        return false;
      }

      if (!canConnect3D(vA, vB)) return false;

      const edge = graph.addEdge(vA, vB, edgeType, { layerIndex });
      if (edge) {
        registerEdge(edge);
        vA.heroJunction = (vA.heroJunction || 0) + (vB.descriptor?.isPrimary ? 1 : 0);
        vB.heroJunction = (vB.heroJunction || 0) + (vA.descriptor?.isPrimary ? 1 : 0);
        const aA = vertexAppearance(vA, vA.descriptor, layerIndex, 'connection', dBoost);
        const aB = vertexAppearance(vB, vB.descriptor, layerIndex, 'connection', dBoost);
        pushSegment(connBuf, vA, vB, aA, aB);
        return true;
      }
      return false;
    }

    const cellDensityAt = (u, v, pp) => {
      const uPeak = sideParams.cellDensityPeak ?? 0.44;
      const chamberBoost = gp(u, uPeak, 0.28) * 0.55 + gp(u, uPeak + 0.30, 0.22) * 0.38;
      const pinchBoost   = pp * 0.45;
      const noise        = 0.5 + 0.3 * Math.sin(u * 11.3 + v * 7.1) + 0.2 * Math.cos(u * 7.7 - v * 5.3);
      return THREE.MathUtils.clamp(0.44 + chamberBoost + pinchBoost + noise * 0.18, 0.30, 1.0);
    };

    for (const nodeA of layerNodes) {
      if (nodeA.edgeFade <= 0.04) continue;
      const cd = cellDensityAt(nodeA.u, nodeA.v, nodeA.pinchProx);
      const bIdx = THREE.MathUtils.clamp(Math.floor(nodeA.u * numBins), 0, numBins - 1);
      const minB = Math.max(0, bIdx - 2);
      const maxB = Math.min(numBins - 1, bIdx + 3);

      const candidates = [];
      const flareEnv = 1.0 - 0.42 * Math.exp(-nodeA.u * 2.2);
      const maxDistA = (layerIndex === 0 ? 0.88 : layerIndex === 1 ? 1.05 : 1.25) * layout.verticalScale * flareEnv;

      for (let b = minB; b <= maxB; b++) {
        for (const nodeB of bins[b]) {
          if (nodeB.id === nodeA.id) continue;
          if (nodeB.u < nodeA.u - 0.001) continue;
          if (nodeB.edgeFade <= 0.04) continue;
          if (graph.hasEdge(nodeA.id, nodeB.id)) continue;

          const dist = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y, (nodeA.z - nodeB.z) * 0.45);
          if (dist <= maxDistA && dist >= minEdgeDist) {
            candidates.push({ node: nodeB, dist });
          }
        }
      }

      candidates.sort((a, b) => a.dist - b.dist);

      const maxNew = layerIndex === 0 ? 3 : 2;
      let added = 0;
      for (const cand of candidates) {
        if (added >= maxNew) break;
        if (nodeA.degree >= (nodeA.descriptor?.isPrimary ? 8 : 5)) break;
        if (cand.node.degree >= 6) continue;

        const prob = cd * (layerIndex === 0 ? 0.75 : layerIndex === 1 ? 0.55 : 0.35);
        if (rng() > prob) continue;

        const edgeType = (nodeA.descriptor?.role === 'accent' && cand.node.descriptor?.role === 'accent')
          ? 'accent' : 'mesh';

        if (addGraphConnection(nodeA, cand.node, edgeType, cd * 0.5)) {
          added++;
          // Triangle closure
          for (const neighborId of nodeA.neighbors) {
            const mutual = graph.nodes.get(neighborId);
            if (mutual && mutual.id !== cand.node.id && !graph.hasEdge(mutual.id, cand.node.id)) {
              const distM = Math.hypot(mutual.x - cand.node.x, mutual.y - cand.node.y, (mutual.z - cand.node.z) * 0.45);
              if (distM <= maxDistA && distM >= minEdgeDist && rng() < 0.60 * cd) {
                addGraphConnection(mutual, cand.node, 'mesh', cd * 0.4);
              }
            }
          }
        }
      }
    }

    // 5. Inter-Sheet 3D Proximity Bridges (between Stream 0 and Stream 1)
    const bridgeMax = 0.58 * layout.verticalScale;
    for (const nodeA of layerNodes) {
      if (nodeA.edgeFade <= 0.04 || nodeA.streamId !== 0) continue;
      const bIdx = THREE.MathUtils.clamp(Math.floor(nodeA.u * numBins), 0, numBins - 1);

      for (let b = Math.max(0, bIdx - 1); b <= Math.min(numBins - 1, bIdx + 2); b++) {
        for (const nodeB of bins[b]) {
          if (nodeB.streamId !== 1 || nodeB.edgeFade <= 0.04) continue;
          const dist3 = Math.hypot(
            Math.abs(nodeA.x - nodeB.x),
            Math.abs(nodeA.y - nodeB.y),
            Math.abs(nodeA.z - nodeB.z) * 0.5
          );
          if (dist3 <= bridgeMax && Math.abs(nodeA.y - nodeB.y) / (Math.abs(nodeA.x - nodeB.x) + 0.001) <= 1.15) {
            if (rng() < 0.55 + 0.28 * nodeA.pinchProx) {
              addGraphConnection(nodeA, nodeB, 'mesh', 0.60);
            }
          }
        }
      }
    }

    // 6. Guarantee No Isolated Nodes: every node has degree >= 1
    for (const node of layerNodes) {
      if (node.degree === 0 && node.edgeFade > 0.04) {
        const bIdx = THREE.MathUtils.clamp(Math.floor(node.u * numBins), 0, numBins - 1);
        let best = null, bestDist = Infinity;
        for (let b = Math.max(0, bIdx - 2); b <= Math.min(numBins - 1, bIdx + 2); b++) {
          for (const nb of bins[b]) {
            if (nb.id === node.id || nb.edgeFade <= 0.04) continue;
            const dist = Math.hypot(node.x - nb.x, node.y - nb.y, (node.z - nb.z) * 0.45);
            if (dist < bestDist && dist > minEdgeDist) {
              bestDist = dist;
              best = nb;
            }
          }
        }
        if (best) {
          addGraphConnection(node, best, 'mesh');
        }
      }
    }

    // 7. Node Hierarchy Classification (Hub Nexus, Medium, Small, Bokeh)
    // Tier 2: Highlight nexus nodes (4 per side on Layer 0)
    if (layerIndex === 0) {
      const nexusUs = sideParams.nexusUs || [0.18, 0.44, 0.70, 0.86];
      const nexusSizes = [0.75, 1.65, 1.25, 0.75];

      nexusUs.forEach((uT, ni) => {
        let best = null, bestScore = Infinity;
        for (const node of layerNodes) {
          const d = node.descriptor;
          let sc;
          if (ni === 1) {
            // Central convergence crossing nexus: strictly prioritize crossing point (y close to 0) and high connectivity
            sc = Math.abs(node.u - uT) * 1.8
              + Math.abs(node.y) * 1.2
              + Math.abs(d.streamV - 0.5) * 0.40
              - Math.min(node.degree, 6) * 0.04
              - (d.isPrimary ? 0.06 : 0.0);
          } else {
            sc = Math.abs(node.u - uT)
              + Math.abs(d.streamV - 0.5) * 0.30
              - Math.min(node.degree, 6) * 0.04
              - (d.isPrimary ? 0.06 : 0.0);
          }
          if (sc < bestScore) {
            bestScore = sc;
            best = node;
          }
        }

        if (best) {
          if (ni === 1) {
            // Signature brilliant optical starburst lens flare at central convergence crossing (matches uploaded image)
            best.tier = 2;
            best.size = 1.95;
            best.colorWeights = [0.95, 0.15, 0.02, 1.00];
            best.alpha = 1.0;
          } else {
            // Refined medium junction twinkle star at crests & transitions (Tier 1)
            best.tier = 1;
            best.size = 0.38;
            const isAccentNexus = ni === 2 && best.descriptor.role === 'accent';
            best.colorWeights = [isAccentNexus ? 0.15 : 0.88, 0.15, isAccentNexus ? 0.90 : 0.05, 0.65];
            best.alpha = 0.88;
          }
        }
      });
    }

    // Medium, Small, and Bokeh nodes
    for (const node of layerNodes) {
      if (node.edgeFade <= 0.03 || node.degree === 0) continue;

      if (node.tier === 2) {
        pushNode(nodeData, node, node.colorWeights, node.alpha, node.size, node.tier);
        canonicalVertices.push(node);
        continue;
      }

      if (layerIndex === 2 && rng() < 0.20) {
        node.tier = 3;
        node.size = 0.45 + 0.45 * rng();
        node.colorWeights = [0.35, 0.65, 0.30, 0.05];
        node.alpha = node.edgeFade * (0.35 + 0.20 * rng());
        pushNode(nodeData, node, node.colorWeights, node.alpha, node.size, node.tier);
        canonicalVertices.push(node);
        continue;
      }

      // Medium nodes: only at prominent high-order network intersections
      const isMedium = layerIndex === 0 && node.degree >= 5 && node.heroJunction >= 2 && rng() < 0.08;

      if (isMedium) {
        node.tier = 1;
        const aM = node.descriptor.role === 'accent' ? 0.85 : 0.08 + 0.15 * rng();
        node.size = 0.28 + 0.08 * rng();
        node.alpha = node.edgeFade * (0.80 + 0.12 * rng());
        node.colorWeights = [0.90, 0.12, aM, 0.70];
        pushNode(nodeData, node, node.colorWeights, node.alpha, node.size, node.tier);
        canonicalVertices.push(node);
      } else {
        const smallP = (layerIndex === 0 && node.degree >= 4) ? 0.025 : 0.004;

        if (rng() < smallP) {
          node.tier = 0;
          const app = vertexAppearance(node, node.descriptor, layerIndex, 'filament');
          node.size = 0.07 + 0.03 * rng();
          node.alpha = node.edgeFade * (0.45 + 0.15 * rng());
          node.colorWeights = [Math.max(0.74, app.weights[0]), app.weights[1] * 0.4, app.weights[2] * 0.5, 0.25];
          pushNode(nodeData, node, node.colorWeights, node.alpha, node.size, node.tier);
          canonicalVertices.push(node);
        }
      }
    }
  });

  return {
    side,
    primaryGeo:  buildLineGeo(primaryBuf),
    filamentGeo: buildLineGeo(filamentBuf),
    meshGeo:     buildLineGeo(meshBuf),
    deepGeo:     buildLineGeo(deepBuf),
    nodeGeo:     buildNodeGeo(nodeData),
    canonicalVertices,
    graph,
  };
}

/**
 * Generates procedural neural wireframe geometries respecting spatialConfig.
 * When side is 'left' or 'right', generates that single formation.
 * When side is 'both' (default), generates both sides using the shared generateSideGeometry
 * pipeline and merges them for complete scene rendering.
 * 
 * @param {object} layout - Layout parameters from computeResponsiveLayout
 * @param {string} [side='both'] - 'both', 'left', or 'right'
 * @returns {object} Geometries, canonical vertices, and graph
 */
export function generateNeuralWireGeometry(layout, side = 'both', options = {}) {
  const opts = typeof options === 'object' && options !== null ? options : {};
  if (side === 'left') return generateSideGeometry('left', layout, opts.left || opts);
  if (side === 'right') return generateSideGeometry('right', layout, opts.right || opts);

  const left = generateSideGeometry('left', layout, opts.left);
  const right = generateSideGeometry('right', layout, opts.right);

  return {
    left,
    right,
    primaryGeo:  mergeLineGeometries(left.primaryGeo, right.primaryGeo),
    filamentGeo: mergeLineGeometries(left.filamentGeo, right.filamentGeo),
    meshGeo:     mergeLineGeometries(left.meshGeo, right.meshGeo),
    deepGeo:     mergeLineGeometries(left.deepGeo, right.deepGeo),
    nodeGeo:     mergeNodeGeometries(left.nodeGeo, right.nodeGeo),
    canonicalVertices: [...left.canonicalVertices, ...right.canonicalVertices],
    graph:       mergeGraphs(left.graph, right.graph),
  };
}

/**
 * Generates ambient floating particle field for a single side formation ('left' or 'right').
 * Hard-clamps all particle positions to strictly preserve the central negative void.
 * 
 * @param {Array} canonicalVertices
 * @param {object} layout
 * @param {object} [spatialBounds]
 * @param {string} [side='left']
 * @param {object|null} [options=null]
 * @returns {THREE.BufferGeometry}
 */
export function generateSideParticles(canonicalVertices, layout, spatialBounds, side = 'left', options = null) {
  const bounds = spatialBounds || layout.bounds || DEFAULT_SPATIAL_BOUNDS;
  const isRight = side === 'right';
  const sideSign = isRight ? 1.0 : -1.0;
  const minXMag = layout.innerGapHalfWidth + 0.001;
  const sideParams = resolveSideParams(side, options);
  const rng = createSeededRandom(sideParams.particleSeed);
  const total = Math.round(5600 * layout.densityScale);

  const positions    = new Float32Array(total * 3);
  const basePos      = new Float32Array(total * 3);
  const colorWeights = new Float32Array(total * 4);
  const alphas       = new Float32Array(total);
  const sizes        = new Float32Array(total);
  const uvParams     = new Float32Array(total * 2);

  const sideVertices = canonicalVertices.filter(
    (v) => (isRight ? v.x > 0 : v.x < 0)
  );
  const poolVertices = sideVertices.length > 0 ? sideVertices : canonicalVertices;

  const activeMesh = poolVertices.filter(
    (v) => v.u >= 0.01 && v.u <= 0.96 && v.edgeFade > 0.06
  );
  const richMesh = activeMesh.filter(
    (v) => v.layerIndex <= 1 && (v.degree >= 2 || v.descriptor?.isPrimary)
  );

  const pool0 = richMesh.length > 0 ? richMesh : activeMesh;
  const pool1 = activeMesh.length > 0 ? activeMesh : poolVertices;

  for (let i = 0; i < total; i++) {
    const roll   = rng();
    const pool   = roll < 0.60 ? pool0 : pool1;
    const anchor = pool[Math.floor(rng() * pool.length)] || {
      x: sideSign * (layout.innerGapHalfWidth + 1.0),
      y: 0,
      z: 0,
      u: 0.5,
      v: 0.5,
      edgeFade: 0.5,
      descriptor: {},
    };

    let px = anchor.x, py = anchor.y, pz = anchor.z;
    let alpha = 0.32, size = 0.035;
    let wP = 0.88, wS = 0.35, wA = anchor.descriptor?.role === 'accent' ? 0.70 : (rng() < 0.20 ? 0.35 : 0.08), wH = 0.04;

    if (roll < 0.52) {
      // Zone 1 (52%) — fine celestial stardust tightly clustered along glowing waves
      const ang = rng() * Math.PI * 2.0;
      const rad = 0.02 + 0.28 * Math.pow(rng(), 1.6);
      px += (isRight ? -1.0 : 1.0) * Math.cos(ang) * rad * 1.10;
      py += Math.sin(ang) * rad * 0.25 * layout.verticalScale;
      pz += (rng() - 0.5) * 0.35;
      size  = 0.026 + 0.040 * Math.pow(rng(), 1.6);
      alpha = (0.30 + 0.35 * rng()) * Math.pow(anchor.edgeFade || 0.5, 0.85);
      if (rng() < 0.20) { wH = 0.25 + 0.15 * rng(); }
    } else if (roll < 0.76) {
      // Zone 2 (24%) — curving constellation arc trails above crest & below trough
      const dY = anchor.y >= 0 ? 1.0 : -1.0;
      const arcRad = 0.08 + 0.45 * Math.pow(rng(), 1.4);
      px += (isRight ? -1.0 : 1.0) * (rng() - 0.5) * 0.65;
      py += dY * arcRad * layout.verticalScale;
      pz += (rng() - 0.5) * 0.50;
      size  = 0.024 + 0.032 * rng();
      alpha = (0.22 + 0.26 * rng()) * Math.pow(anchor.edgeFade || 0.5, 0.88);
      wP = 0.90; wS = 0.40;
    } else if (roll < 0.90) {
      // Zone 3 (14%) — depth-layer suspended celestial dust & soft bokeh
      px += (isRight ? -1.0 : 1.0) * (rng() - 0.5) * 0.95;
      py += (rng() - 0.5) * 0.45 * layout.verticalScale;
      pz -= 0.15 + rng() * 2.80;
      size  = 0.025 + 0.035 * Math.pow(rng(), 1.6);
      alpha = (0.20 + 0.25 * rng()) * Math.pow(anchor.edgeFade || 0.5, 0.88);
      wS = 0.60; wA = Math.max(wA, 0.30 * rng());
    } else {
      // Zone 4 (10%) — outer celestial sparks floating around the energy ribbons
      const ang = rng() * Math.PI * 2.0;
      const dist = 0.30 + 0.50 * Math.pow(rng(), 1.5);
      px += (isRight ? -1.0 : 1.0) * Math.cos(ang) * dist * 1.15;
      py += Math.sin(ang) * dist * 0.45 * layout.verticalScale;
      pz += (rng() - 0.5) * 0.65;
      size  = 0.024 + 0.030 * rng();
      alpha = (0.24 + 0.26 * rng()) * Math.pow(anchor.edgeFade || 0.5, 0.85);
      wP = 0.86; wS = 0.40; wA = anchor.descriptor?.role === 'accent' ? 0.70 : (rng() < 0.25 ? 0.40 : 0.05); wH = rng() < 0.25 ? 0.30 : 0.05;
    }

    // Strict boundary enforcement: NEVER inside central exclusion zone
    px = clampToFormation(px, side, bounds);
    if (isRight) {
      px = Math.max(minXMag, px);
    } else {
      px = Math.min(-minXMag, px);
    }

    py = THREE.MathUtils.clamp(py, -bounds.verticalExtent * 1.2, bounds.verticalExtent * 1.2);
    pz = THREE.MathUtils.clamp(pz, bounds.depthRange.min, bounds.depthRange.max);

    const i3 = i * 3, i4 = i * 4, i2 = i * 2;
    positions[i3]     = px; positions[i3 + 1] = py; positions[i3 + 2] = pz;
    basePos[i3]       = px; basePos[i3 + 1]   = py; basePos[i3 + 2]   = pz;
    colorWeights[i4]  = wP; colorWeights[i4 + 1] = wS; colorWeights[i4 + 2] = wA; colorWeights[i4 + 3] = wH;
    alphas[i]         = alpha;
    sizes[i]          = size;
    uvParams[i2]      = anchor.u || 0;
    uvParams[i2 + 1]  = anchor.v || 0;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',      new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aBasePosition', new THREE.BufferAttribute(basePos, 3));
  geo.setAttribute('aColorWeights', new THREE.BufferAttribute(colorWeights, 4));
  geo.setAttribute('aAlpha',        new THREE.BufferAttribute(alphas, 1));
  geo.setAttribute('aParticleSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aUvParam',      new THREE.BufferAttribute(uvParams, 2));
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Generates ambient floating particle field clustered around wire formations.
 * When side is 'left' or 'right', generates that single formation.
 * When side is 'both' (default), generates both sides using generateSideParticles
 * and merges them.
 * 
 * @param {Array} canonicalVertices
 * @param {object} layout
 * @param {object} [spatialBounds]
 * @param {string} [side='both']
 * @returns {THREE.BufferGeometry}
 */
export function generateNeuralWireParticles(canonicalVertices, layout, spatialBounds, side = 'both', options = {}) {
  const opts = typeof options === 'object' && options !== null ? options : {};
  if (side === 'left') return generateSideParticles(canonicalVertices, layout, spatialBounds, 'left', opts.left || opts);
  if (side === 'right') return generateSideParticles(canonicalVertices, layout, spatialBounds, 'right', opts.right || opts);

  const pL = generateSideParticles(canonicalVertices, layout, spatialBounds, 'left', opts.left);
  const pR = generateSideParticles(canonicalVertices, layout, spatialBounds, 'right', opts.right);

  return mergeParticleGeometries(pL, pR);
}
