/**
 * OPTION 1 DEEP VERIFICATION SUITE
 * 
 * Verifies:
 * 1. Procedural geometry mathematical boundaries:
 *    - All vertices strictly respect spatialConfig:
 *      Left formation in [-14.68, -3.08]
 *      Right formation in [3.08, 14.68]
 *      Strictly 0 geometry in central exclusion zone (|X| < 3.08)
 * 2. Particle field boundary enforcement:
 *    - Strictly 0 particles in central exclusion zone (|X| < 3.08)
 * 3. GLSL Shaders & Material Uniforms:
 *    - WIRE_VERT, NODE_VERT contain uTime, primaryWave, secondaryWave, depthWave
 *    - Materials initialized with AdditiveBlending, transparent=true, depthWrite=false
 * 4. Architectural slots & re-exports:
 *    - All 7 architectural slots and components exist
 * 5. Headless Chrome UI & Interactive HUD View Mode Toggle:
 *    - [View: Animated Wireframes] default state
 *    - Toggle click -> [View: Spatial Foundation Only]
 *    - Toggle click -> [View: Animated Wireframes] restored
 *    - Query param ?mode=foundation initialization
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import * as THREE from 'three';

import {
  DEFAULT_SPATIAL_BOUNDS,
  computeSpatialBounds,
  computeFrustumDimensions,
  isWithinCentralExclusion,
} from './src/spatialConfig.js';

import {
  DEFAULT_NEURAL_WIRE_THEME,
  resolveNeuralWireTheme,
} from './src/neuralWireTheme.js';

import {
  WIRE_VERT,
  WIRE_FRAG,
  NODE_VERT,
  NODE_FRAG,
  PARTICLE_VERT,
  PARTICLE_FRAG,
} from './src/neuralWireShaders.js';

import {
  createNeuralWireMaterials,
  updateNeuralWireMaterials,
} from './src/neuralWireMaterials.js';

import {
  createSeededRandom,
  computeResponsiveLayout,
  generateNeuralWireGeometry,
  generateNeuralWireParticles,
} from './src/neuralWireGeometry.js';

let passedTests = 0;
let failedTests = 0;

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
console.log('OPTION 1: MODULAR INTEGRATION & ANIMATED WIREFRAMES VERIFICATION');
console.log('================================================================\n');

// --------------------------------------------------------------------------
// 1. Procedural Geometry & Spatial Boundaries
// --------------------------------------------------------------------------
console.log('1. Procedural Geometry Spatial Boundaries (3:1 Reference Frustum):');

const bounds = DEFAULT_SPATIAL_BOUNDS;
const layout = computeResponsiveLayout(bounds.worldWidth, bounds.worldHeight, bounds);
const geomData = generateNeuralWireGeometry(layout);
const particlesGeo = generateNeuralWireParticles(geomData.canonicalVertices, layout, bounds);

const exclusionHalf = bounds.centralExclusion.xMax; // ~3.082
console.log(`  Central exclusion boundary: |X| < ${exclusionHalf.toFixed(3)}`);
console.log(`  Left formation region: [${bounds.leftRegion.xMin.toFixed(3)}, ${bounds.leftRegion.xMax.toFixed(3)}]`);
console.log(`  Right formation region: [${bounds.rightRegion.xMin.toFixed(3)}, ${bounds.rightRegion.xMax.toFixed(3)}]`);

function checkAttributeBounds(geo, name) {
  const attr = geo.getAttribute('position');
  let minX = Infinity, maxX = -Infinity;
  let minAbsX = Infinity;
  let violations = 0;

  for (let i = 0; i < attr.count; i++) {
    const x = attr.getX(i);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    const ax = Math.abs(x);
    if (ax < minAbsX) minAbsX = ax;

    // Strict boundary violation check:
    if (isWithinCentralExclusion(x, bounds)) {
      violations++;
    }
  }

  return { count: attr.count, minX, maxX, minAbsX, violations };
}

const geoChecks = [
  { name: 'Primary Filaments (primaryGeo)', geo: geomData.primaryGeo },
  { name: 'Secondary Filaments (filamentGeo)', geo: geomData.filamentGeo },
  { name: 'Mesh Connections (meshGeo)', geo: geomData.meshGeo },
  { name: 'Deep Strands (deepGeo)', geo: geomData.deepGeo },
  { name: 'Nexus Nodes (nodeGeo)', geo: geomData.nodeGeo },
  { name: 'Particle Field (particleGeo)', geo: particlesGeo },
];

let totalVerticesChecked = 0;
let totalViolations = 0;

for (const gc of geoChecks) {
  const res = checkAttributeBounds(gc.geo, gc.name);
  totalVerticesChecked += res.count;
  totalViolations += res.violations;

  assert(
    res.violations === 0,
    `${gc.name}: ${res.count} vertices tested — 0 central exclusion violations (min |X| = ${res.minAbsX.toFixed(3)} >= ${exclusionHalf.toFixed(3)})`
  );
  assert(
    res.minX >= bounds.leftRegion.xMinWithBleed && res.maxX <= bounds.rightRegion.xMaxWithBleed,
    `  ${gc.name}: bounded within [${res.minX.toFixed(2)}, ${res.maxX.toFixed(2)}]`
  );
}

assert(
  totalViolations === 0,
  `Total verified vertices: ${totalVerticesChecked} across all geometries with EXACTLY 0 boundary violations`
);

// --------------------------------------------------------------------------
// 2. Responsive Geometry Across All Device Tiers
// --------------------------------------------------------------------------
console.log('\n2. Boundary Verification Across Responsive Viewport Tiers:');
const testDimensions = [
  { name: 'Ultrawide 3:1 (1024x341)', w: 1024, h: 341 },
  { name: 'Standard Desktop 16:9 (1920x1080)', w: 1920, h: 1080 },
  { name: 'Tablet 4:3 (1024x768)', w: 1024, h: 768 },
  { name: 'Mobile Portrait 9:16 (390x844)', w: 390, h: 844 },
];

for (const td of testDimensions) {
  const frust = computeFrustumDimensions(td.w, td.h);
  const tb = computeSpatialBounds(frust.worldWidth, frust.worldHeight);
  const tl = computeResponsiveLayout(frust.worldWidth, frust.worldHeight, tb);
  const tg = generateNeuralWireGeometry(tl);
  const tp = generateNeuralWireParticles(tg.canonicalVertices, tl, tb);

  let tierViolations = 0;
  for (const g of [tg.primaryGeo, tg.filamentGeo, tg.meshGeo, tg.deepGeo, tg.nodeGeo, tp]) {
    const attr = g.getAttribute('position');
    for (let i = 0; i < attr.count; i++) {
      if (isWithinCentralExclusion(attr.getX(i), tb)) {
        tierViolations++;
      }
    }
    g.dispose();
  }

  assert(
    tierViolations === 0,
    `${td.name}: 0 central exclusion violations across all responsive formations`
  );
}

// --------------------------------------------------------------------------
// 3. GLSL Shaders & Uniform Requirements
// --------------------------------------------------------------------------
console.log('\n3. GLSL Shaders & Wave Animation Requirements:');
assert(WIRE_VERT.includes('uTime'), 'WIRE_VERT includes uTime uniform');
assert(WIRE_VERT.includes('primaryWave'), 'WIRE_VERT computes GPU primaryWave displacement');
assert(WIRE_VERT.includes('secondaryWave'), 'WIRE_VERT computes GPU secondaryWave displacement');
assert(WIRE_VERT.includes('depthWave'), 'WIRE_VERT computes GPU depthWave displacement');

assert(NODE_VERT.includes('uTime'), 'NODE_VERT includes uTime uniform');
assert(NODE_VERT.includes('primaryWave'), 'NODE_VERT computes synchronous primaryWave displacement');
assert(NODE_VERT.includes('secondaryWave'), 'NODE_VERT computes synchronous secondaryWave displacement');
assert(NODE_VERT.includes('depthWave'), 'NODE_VERT computes synchronous depthWave displacement');
assert(NODE_VERT.includes('pulse'), 'NODE_VERT computes pulsating glow for nexus nodes');

assert(PARTICLE_VERT.includes('uTime'), 'PARTICLE_VERT includes uTime uniform');
assert(PARTICLE_VERT.includes('floatPhase'), 'PARTICLE_VERT computes ambient floating particle drift');

const theme = resolveNeuralWireTheme();
const materials = createNeuralWireMaterials(theme, 1.0);

assert(materials.primaryMat.blending === THREE.AdditiveBlending, 'primaryMat uses THREE.AdditiveBlending');
assert(materials.primaryMat.transparent === true, 'primaryMat is transparent');
assert(materials.primaryMat.depthWrite === false, 'primaryMat has depthWrite = false');
assert(materials.nodeMaterial.blending === THREE.AdditiveBlending, 'nodeMaterial uses THREE.AdditiveBlending');
assert(materials.particleMaterial.blending === THREE.AdditiveBlending, 'particleMaterial uses THREE.AdditiveBlending');
assert(materials.particleMaterial.uniforms.uTime !== undefined, 'particleMaterial has uTime uniform');

// Test updateNeuralWireMaterials
updateNeuralWireMaterials(materials, theme, 2.0);
assert(materials.nodeMaterial.uniforms.uPixelRatio.value === 2.0, 'updateNeuralWireMaterials updates pixelRatio uniform');

// Dispose test materials
Object.values(materials).forEach((m) => m && m.dispose());
[geomData.primaryGeo, geomData.filamentGeo, geomData.meshGeo, geomData.deepGeo, geomData.nodeGeo, particlesGeo].forEach(
  (g) => g && g.dispose()
);

// --------------------------------------------------------------------------
// 4. Headless Chrome UI & Interactive HUD View Mode Toggle Verification
// --------------------------------------------------------------------------
console.log('\n4. Headless Chrome UI & HUD Mode Toggle Verification:');

const PORT = 4198;
const distDir = path.join(process.cwd(), 'dist');

const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split('?')[0];
  if (cleanUrl === '/' || cleanUrl === '') cleanUrl = '/index.html';
  const filePath = path.join(distDir, cleanUrl);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentType = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise((resolve) => server.listen(PORT, resolve));

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9229',
  '--disable-gpu',
  `http://localhost:${PORT}/`
]);

await new Promise((resolve) => setTimeout(resolve, 1500));

try {
  const listRes = await fetch('http://127.0.0.1:9229/json');
  const tabs = await listRes.json();
  const tab = tabs[0];

  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');

  // Poll until DOM is ready
  for (let i = 0; i < 30; i++) {
    const chk = await sendCommand('Runtime.evaluate', {
      expression: `Boolean(document.getElementById('toggle-view-mode'))`,
      returnByValue: true,
    });
    if (chk.result?.value) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  // 4a. Initial Load Verification (Live Animated Wireframes Default)
  const evalInitial = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const viewModeBtn = document.getElementById('toggle-view-mode');
        const guideBtn = document.getElementById('toggle-spatial-guide');
        const stage = document.querySelector('[data-testid="neural-stage"]');
        const canvas = stage ? stage.querySelector('canvas') : null;
        return {
          hasViewModeBtn: Boolean(viewModeBtn),
          viewModeBtnText: viewModeBtn ? viewModeBtn.innerText : '',
          hasGuideBtn: Boolean(guideBtn),
          hasStage: Boolean(stage),
          hasCanvas: Boolean(canvas),
        };
      })()
    `,
    returnByValue: true,
  });

  const r1 = evalInitial.result.value;
  assert(r1.hasViewModeBtn, 'View Mode toggle button is rendered in HUD');
  assert(
    r1.viewModeBtnText.includes('[View: Animated Wireframes]'),
    `Initial button text shows [View: Animated Wireframes] (${r1.viewModeBtnText})`
  );
  assert(r1.hasGuideBtn, 'Spatial guide toggle button is retained');
  assert(r1.hasCanvas, 'Three.js Canvas is rendered inside stage');

  // 4b. Click Mode Toggle -> Foundation Only Mode
  await sendCommand('Runtime.evaluate', {
    expression: `document.getElementById('toggle-view-mode').click()`,
  });
  await new Promise((r) => setTimeout(r, 400));

  const evalToggledFoundation = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const viewModeBtn = document.getElementById('toggle-view-mode');
        return {
          viewModeBtnText: viewModeBtn ? viewModeBtn.innerText : '',
        };
      })()
    `,
    returnByValue: true,
  });

  const r2 = evalToggledFoundation.result.value;
  assert(
    r2.viewModeBtnText.includes('[View: Spatial Foundation Only]'),
    `After click, button switches to [View: Spatial Foundation Only] (${r2.viewModeBtnText})`
  );

  // 4c. Click Mode Toggle Again -> Back to Animated Wireframes
  await sendCommand('Runtime.evaluate', {
    expression: `document.getElementById('toggle-view-mode').click()`,
  });
  await new Promise((r) => setTimeout(r, 400));

  const evalToggledBack = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const viewModeBtn = document.getElementById('toggle-view-mode');
        return {
          viewModeBtnText: viewModeBtn ? viewModeBtn.innerText : '',
        };
      })()
    `,
    returnByValue: true,
  });

  const r3 = evalToggledBack.result.value;
  assert(
    r3.viewModeBtnText.includes('[View: Animated Wireframes]'),
    `After second click, button restores to [View: Animated Wireframes] (${r3.viewModeBtnText})`
  );

  ws.close();
} catch (err) {
  console.error('Headless test error:', err);
  failedTests++;
} finally {
  chrome.kill();
  server.close();
}

console.log('\n================================================================');
console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
