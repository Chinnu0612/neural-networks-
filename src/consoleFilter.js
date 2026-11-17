import * as THREE from 'three';

/**
 * Creates a console interceptor callback for Three.js (THREE.setConsoleFunction).
 *
 * It specifically suppresses the upstream THREE.Clock deprecation warning:
 *   "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead."
 * which is emitted upstream by @react-three/fiber when <Canvas> initializes its internal store.
 *
 * All other logs, warnings, errors, and TSL (Three Shading Language) stack traces
 * are strictly preserved and forwarded to the console or any previously installed handler.
 *
 * @param {Function|null} [prevHandler=null] - Optional previously registered console handler to chain to.
 * @returns {Function} Three.js console callback (type, message, ...params) => void
 */
export function createThreeConsoleFilter(prevHandler = null) {
  return function threeConsoleHandler(type, message, ...params) {
    // Specifically suppress upstream THREE.Clock deprecation warning from @react-three/fiber
    if (
      type === 'warn' &&
      typeof message === 'string' &&
      message.includes('Clock: This module has been deprecated')
    ) {
      return;
    }

    // If an external custom console function was already registered, forward to it
    if (typeof prevHandler === 'function') {
      prevHandler(type, message, ...params);
      return;
    }

    // Native Three.js console dispatch behavior, fully preserving TSL stack traces
    const stackTrace = params[0];
    if (type === 'warn') {
      if (stackTrace && stackTrace.isStackTrace) {
        console.warn(stackTrace.getError(message), ...params.slice(1));
      } else {
        console.warn(message, ...params);
      }
    } else if (type === 'error') {
      if (stackTrace && stackTrace.isStackTrace) {
        console.error(stackTrace.getError(message), ...params.slice(1));
      } else {
        console.error(message, ...params);
      }
    } else if (typeof console[type] === 'function') {
      console[type](message, ...params);
    } else {
      console.log(message, ...params);
    }
  };
}

let installedHandler = null;

/**
 * Idempotently installs the Three.js console filter on the given Three.js instance.
 *
 * @param {typeof THREE} [threeInstance=THREE]
 * @returns {Function} The installed console handler
 */
export function initThreeConsoleFilter(threeInstance = THREE) {
  const current = threeInstance.getConsoleFunction ? threeInstance.getConsoleFunction() : null;
  if (current && current === installedHandler) {
    return installedHandler;
  }
  installedHandler = createThreeConsoleFilter(current);
  threeInstance.setConsoleFunction(installedHandler);
  return installedHandler;
}
