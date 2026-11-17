/**
 * Interactive Guide Toggle & DOM Verification Suite
 * Spawns headless Chrome and tests:
 * 1. Default load (/) has guide enabled by default (HUD is present, overlay is present).
 * 2. Stage element has glowing border and box shadow styling.
 * 3. Clicking #toggle-spatial-guide toggles the guide off (clean foundation).
 * 4. Clicking #toggle-spatial-guide again restores the guide (ON).
 * 5. Explicit URL ?guide=0 loads in clean mode directly.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

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
console.log('INTERACTIVE SPATIAL GUIDE TOGGLE & UI VERIFICATION');
console.log('================================================================\n');

const PORT = 4199;
const distDir = path.join(process.cwd(), 'dist');

const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split('?')[0];
  if (cleanUrl === '/' || cleanUrl === '') cleanUrl = '/index.html';
  let filePath = path.join(distDir, cleanUrl);
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
  '--remote-debugging-port=9227',
  '--disable-gpu',
  `http://localhost:${PORT}/`
]);

await new Promise((resolve) => setTimeout(resolve, 1500));

try {
  const listRes = await fetch('http://127.0.0.1:9227/json');
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
  await new Promise((r) => setTimeout(r, 1000));

  // 1. Check default load (/)
  console.log('1. Default Root Load (/) Verification:');
  const evalInitial = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const hud = document.querySelector('header[aria-label="Scene Status HUD"]');
        const stage = document.querySelector('[data-testid="neural-stage"]');
        const overlay = document.querySelector('[data-testid="spatial-guide-overlay"]');
        const toggleBtn = document.getElementById('toggle-spatial-guide');
        return {
          hasHud: Boolean(hud),
          hudText: hud ? hud.innerText : '',
          hasStage: Boolean(stage),
          stageBorder: stage ? stage.style.border : '',
          stageBoxShadow: stage ? stage.style.boxShadow : '',
          hasOverlay: Boolean(overlay),
          toggleBtnText: toggleBtn ? toggleBtn.innerText : '',
        };
      })()
    `,
    returnByValue: true,
  });

  const r1 = evalInitial.result.value;
  assert(r1.hasHud, 'HUD banner is rendered in DOM');
  assert(r1.hudText.includes('Phase 1: Scene Foundation & Spatial Bounds'), 'HUD contains project status');
  assert(r1.hudText.includes('Left 39.5%') && r1.hudText.includes('Central Void 21.0%'), 'HUD contains proportions');
  assert(r1.hudText.includes('Tier:') && r1.hudText.includes('Stage:'), 'HUD contains live metrics');
  assert(r1.hasStage, 'Stage element is rendered');
  assert(r1.stageBorder.includes('rgba(0, 229, 255'), `Stage has visible cyan border (${r1.stageBorder})`);
  assert(r1.stageBoxShadow.includes('rgba(0, 229, 255'), `Stage has ambient glow boxShadow (${r1.stageBoxShadow})`);
  assert(r1.hasOverlay, 'Spatial guide overlay is ENABLED by default at root URL (/)');
  assert(r1.toggleBtnText.includes('ON'), 'Toggle button displays ON state by default');

  // 2. Click Toggle Button -> Clean Foundation
  console.log('\n2. Interactive Toggle Click -> Clean Mode:');
  await sendCommand('Runtime.evaluate', {
    expression: `document.getElementById('toggle-spatial-guide').click()`,
  });
  await new Promise((r) => setTimeout(r, 400));

  const evalToggledOff = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const overlay = document.querySelector('[data-testid="spatial-guide-overlay"]');
        const toggleBtn = document.getElementById('toggle-spatial-guide');
        const hud = document.querySelector('header[aria-label="Scene Status HUD"]');
        const stage = document.querySelector('[data-testid="neural-stage"]');
        return {
          hasOverlay: Boolean(overlay),
          toggleBtnText: toggleBtn ? toggleBtn.innerText : '',
          hasHud: Boolean(hud),
          hasStage: Boolean(stage),
        };
      })()
    `,
    returnByValue: true,
  });

  const r2 = evalToggledOff.result.value;
  assert(!r2.hasOverlay, 'Spatial guide overlay is hidden after clicking toggle button');
  assert(r2.toggleBtnText.includes('OFF'), 'Toggle button displays OFF state');
  assert(r2.hasHud, 'HUD remains visible and persistent in clean mode');
  assert(r2.hasStage, 'Stage with glowing border remains visible and persistent in clean mode');

  // 3. Click Toggle Button Again -> Guide Mode Restored
  console.log('\n3. Interactive Toggle Click -> Guide Restored:');
  await sendCommand('Runtime.evaluate', {
    expression: `document.getElementById('toggle-spatial-guide').click()`,
  });
  await new Promise((r) => setTimeout(r, 400));

  const evalToggledOn = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const overlay = document.querySelector('[data-testid="spatial-guide-overlay"]');
        const toggleBtn = document.getElementById('toggle-spatial-guide');
        return {
          hasOverlay: Boolean(overlay),
          toggleBtnText: toggleBtn ? toggleBtn.innerText : '',
        };
      })()
    `,
    returnByValue: true,
  });

  const r3 = evalToggledOn.result.value;
  assert(r3.hasOverlay, 'Spatial guide overlay is restored after second click');
  assert(r3.toggleBtnText.includes('ON'), 'Toggle button displays ON state again');

  // 4. Test explicit URL ?guide=0 in fresh session
  console.log('\n4. Explicit URL ?guide=0 (Clean Initial Mode):');
  
  const chromeClean = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9228',
    '--disable-gpu',
    `http://localhost:${PORT}/?guide=0`
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const cleanListRes = await fetch('http://127.0.0.1:9228/json');
    const cleanTabs = await cleanListRes.json();
    const cleanTab = cleanTabs.find((t) => t.type === 'page' && t.url.includes('4199')) || cleanTabs[0];
    console.log('  Selected tab URL:', cleanTab.url);

    const cleanWs = new WebSocket(cleanTab.webSocketDebuggerUrl);

    let cleanMsgId = 1;
    const cleanPending = new Map();

    function sendCleanCommand(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++cleanMsgId;
        cleanPending.set(id, { resolve, reject });
        cleanWs.send(JSON.stringify({ id, method, params }));
      });
    }

    cleanWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && cleanPending.has(msg.id)) {
        const { resolve, reject } = cleanPending.get(msg.id);
        cleanPending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise((resolve) => {
      cleanWs.onopen = resolve;
    });

    await sendCleanCommand('Runtime.enable');
    
    // Poll until DOM is ready
    for (let i = 0; i < 30; i++) {
      const chk = await sendCleanCommand('Runtime.evaluate', {
        expression: `Boolean(document.getElementById('toggle-spatial-guide'))`,
        returnByValue: true,
      });
      if (chk.result?.value) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    const evalCleanUrl = await sendCleanCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const overlay = document.querySelector('[data-testid="spatial-guide-overlay"]');
          const toggleBtn = document.getElementById('toggle-spatial-guide');
          const hud = document.querySelector('header[aria-label="Scene Status HUD"]');
          const stage = document.querySelector('[data-testid="neural-stage"]');
          return {
            hasOverlay: Boolean(overlay),
            toggleBtnText: toggleBtn ? toggleBtn.innerText : '',
            hasHud: Boolean(hud),
            hasStage: Boolean(stage),
          };
        })()
      `,
      returnByValue: true,
    });

    const r4 = evalCleanUrl.result.value;
    assert(!r4.hasOverlay, '?guide=0 initializes directly into clean foundation mode (overlay is null)');
    assert(r4.toggleBtnText.includes('OFF'), `Toggle button initializes to OFF on ?guide=0 (${r4.toggleBtnText})`);
    assert(r4.hasHud, 'HUD is active and persistent on ?guide=0');
    assert(r4.hasStage, 'Stage with glowing border is active on ?guide=0');

    cleanWs.close();
  } finally {
    chromeClean.kill();
  }

  ws.close();
} catch (err) {
  console.error('Test execution failed:', err);
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
