/**
 * Deep Verification Test Suite for Three.js Console Filter
 *
 * Verifies:
 * 1. Specific suppression of THREE.Clock deprecation warning
 * 2. Strict preservation of all other THREE.warn warnings
 * 3. Strict preservation of THREE.error messages
 * 4. Strict preservation of THREE.log messages
 * 5. Strict preservation of TSL (Three Shading Language) stack traces for warn and error
 * 6. Forwarding / chaining to pre-existing custom console handlers
 * 7. Safe idempotent installation
 * 8. Defensive boundary handling (null, undefined, objects, non-strings)
 * 9. Real browser CDP test ensuring 0 console warnings during full app mount
 */

import * as THREE from 'three';
import StackTrace from 'three/src/nodes/core/StackTrace.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createThreeConsoleFilter, initThreeConsoleFilter } from './src/consoleFilter.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

let interceptedWarns = [];
let interceptedErrors = [];
let interceptedLogs = [];

const originalWarn = console.warn;
const originalError = console.error;
const originalLog = console.log;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    process.stdout.write(`  [PASS] ${message}\n`);
  } else {
    failedTests++;
    process.stderr.write(`  [FAIL] ${message}\n`);
  }
}

process.stdout.write('\n================================================================\n');
process.stdout.write('THREE.JS CONSOLE FILTER DEEP VERIFICATION SUITE\n');
process.stdout.write('================================================================\n\n');

process.stdout.write('1. THREE.Clock Deprecation Suppression:\n');

console.warn = (...args) => interceptedWarns.push(args);
console.error = (...args) => interceptedErrors.push(args);
console.log = (...args) => interceptedLogs.push(args);

try {
  THREE.setConsoleFunction(null); // Reset
  initThreeConsoleFilter(THREE);

  // Instantiating Clock emits "Clock: This module has been deprecated. Please use THREE.Timer instead."
  new THREE.Clock();
  new THREE.Clock();
  new THREE.Clock();

  assert(interceptedWarns.length === 0, 'THREE.Clock deprecation warnings are completely suppressed (count === 0)');
} finally {
  console.warn = originalWarn;
  console.error = originalError;
  console.log = originalLog;
}

// -----------------------------------------------------------------------------
// Test 2: Non-suppression of legitimate warnings
// -----------------------------------------------------------------------------
console.log('\n2. Legitimate Warning Preservation:');

interceptedWarns = [];
console.warn = (...args) => interceptedWarns.push(args);

try {
  THREE.warn('Material: Shader compilation warning', { code: 101 });
  assert(interceptedWarns.length === 1, 'Legitimate THREE.warn calls are NOT suppressed');
  assert(interceptedWarns[0][0] === 'THREE.Material: Shader compilation warning', 'Warning message retains THREE. prefix');
  assert(interceptedWarns[0][1]?.code === 101, 'Warning extra parameters are fully preserved');

  THREE.warn('Another warning about lights');
  assert(interceptedWarns.length === 2, 'Consecutive warnings are preserved');
} finally {
  console.warn = originalWarn;
}

// -----------------------------------------------------------------------------
// Test 3: Error Preservation
// -----------------------------------------------------------------------------
console.log('\n3. Real Error Preservation:');

interceptedErrors = [];
console.error = (...args) => interceptedErrors.push(args);

try {
  THREE.error('WebGLRenderer: Context lost', { fatal: true });
  assert(interceptedErrors.length === 1, 'Legitimate THREE.error calls are NOT suppressed');
  assert(interceptedErrors[0][0] === 'THREE.WebGLRenderer: Context lost', 'Error message retains THREE. prefix');
  assert(interceptedErrors[0][1]?.fatal === true, 'Error extra parameters are fully preserved');
} finally {
  console.error = originalError;
}

// -----------------------------------------------------------------------------
// Test 4: Log Preservation
// -----------------------------------------------------------------------------
console.log('\n4. Informational Log Preservation:');

interceptedLogs = [];
console.log = (...args) => interceptedLogs.push(args);

try {
  THREE.log('WebGLRenderer: Compiled program in 42ms');
  assert(interceptedLogs.length === 1, 'THREE.log calls are NOT suppressed');
  assert(interceptedLogs[0][0] === 'THREE.WebGLRenderer: Compiled program in 42ms', 'Log message retains THREE. prefix');
} finally {
  console.log = originalLog;
}

// -----------------------------------------------------------------------------
// Test 5: TSL (Three Shading Language) Stack Trace Handling
// -----------------------------------------------------------------------------
console.log('\n5. TSL Stack Trace Preservation:');

interceptedWarns = [];
interceptedErrors = [];
console.warn = (...args) => interceptedWarns.push(args);
console.error = (...args) => interceptedErrors.push(args);

try {
  const fakeStackTrace = new StackTrace();
  
  // TSL warn
  THREE.warn('TSL: Node connection type mismatch', fakeStackTrace);
  assert(interceptedWarns.length === 1, 'TSL warning with StackTrace is NOT suppressed');
  assert(typeof interceptedWarns[0][0] === 'string', 'TSL warning was properly resolved through stackTrace.getError()');
  assert(interceptedWarns[0][0].includes('TSL: Node connection type mismatch'), 'TSL warning contains original message');

  // TSL error
  THREE.error('TSL: Cyclic dependency detected', fakeStackTrace);
  assert(interceptedErrors.length === 1, 'TSL error with StackTrace is NOT suppressed');
  assert(typeof interceptedErrors[0][0] === 'string', 'TSL error was properly resolved through stackTrace.getError()');
  assert(interceptedErrors[0][0].includes('TSL: Cyclic dependency detected'), 'TSL error contains original error message');
} finally {
  console.warn = originalWarn;
  console.error = originalError;
}

// -----------------------------------------------------------------------------
// Test 6: Pre-existing Handler Chaining
// -----------------------------------------------------------------------------
console.log('\n6. Chaining with Pre-existing Custom Console Handlers:');

const preExistingCalls = [];
const customHandler = (type, message, ...params) => {
  preExistingCalls.push({ type, message, params });
};

const chainedFilter = createThreeConsoleFilter(customHandler);
THREE.setConsoleFunction(chainedFilter);

new THREE.Clock(); // Should be suppressed before reaching customHandler
assert(preExistingCalls.length === 0, 'THREE.Clock deprecation is intercepted before reaching pre-existing handler');

THREE.warn('Custom: Something happened', 'extraParam');
assert(preExistingCalls.length === 1, 'Pre-existing handler receives legitimate warnings');
assert(preExistingCalls[0].type === 'warn', 'Handler receives correct log level type');
assert(preExistingCalls[0].message === 'THREE.Custom: Something happened', 'Handler receives formatted message');
assert(preExistingCalls[0].params[0] === 'extraParam', 'Handler receives extra arguments');

// -----------------------------------------------------------------------------
// Test 7: Idempotency & Edge Cases
// -----------------------------------------------------------------------------
console.log('\n7. Idempotency & Robust Boundary Handling:');

THREE.setConsoleFunction(null);
const h1 = initThreeConsoleFilter(THREE);
const h2 = initThreeConsoleFilter(THREE);
assert(h1 === h2, 'Multiple initThreeConsoleFilter calls return same handler without infinite wrapping');

// Test handler with non-string, null, or empty arguments directly
interceptedWarns = [];
console.warn = (...args) => interceptedWarns.push(args);
try {
  h1('warn', null);
  h1('warn', undefined);
  h1('warn', 12345);
  h1('warn', { custom: 'object' });
  assert(interceptedWarns.length === 4, 'Handler safely handles non-string messages without throwing');
} finally {
  console.warn = originalWarn;
}

// -----------------------------------------------------------------------------
// Test 8: Live Headless Chrome End-to-End Verification
// -----------------------------------------------------------------------------
console.log('\n8. Headless Browser End-to-End Console Verification:');

async function testHeadlessChrome() {
  const PORT = 4198;
  const distDir = path.join(process.cwd(), 'dist');

  if (!fs.existsSync(distDir)) {
    console.error('  [FAIL] dist directory does not exist! Run npm run build first.');
    failedTests++;
    return;
  }

  const server = http.createServer((req, res) => {
    let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
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
    '--remote-debugging-port=9226',
    '--disable-gpu',
    `http://localhost:${PORT}`
  ]);

  await new Promise((resolve) => setTimeout(resolve, 1500));

  let browserWarnings = [];
  let browserErrors = [];

  try {
    const listRes = await fetch('http://127.0.0.1:9226/json');
    const tabs = await listRes.json();
    const tab = tabs[0];

    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      ws.onopen = () => {
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
        ws.send(JSON.stringify({ id: 2, method: 'Page.reload' }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          const type = msg.params.type;
          const text = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
          if (type === 'warning') browserWarnings.push(text);
          if (type === 'error') browserErrors.push(text);
        }
      };

      setTimeout(() => {
        ws.close();
        resolve();
      }, 3000);
    });

    const clockWarnings = browserWarnings.filter((t) => t.includes('Clock: This module has been deprecated'));
    assert(clockWarnings.length === 0, 'No THREE.Clock deprecation warnings emitted in browser console');
    assert(browserErrors.length === 0, `No errors emitted in browser console (errors: ${browserErrors.length})`);
    assert(browserWarnings.length === 0, `Browser console is completely clean (total warnings: ${browserWarnings.length})`);
  } catch (err) {
    console.error('  [FAIL] Chrome test exception:', err);
    failedTests++;
  } finally {
    chrome.kill();
    server.close();
  }
}

await testHeadlessChrome();

console.log('\n================================================================');
console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
