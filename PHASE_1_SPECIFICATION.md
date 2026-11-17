# Phase 1 Technical Specification: 3D Scene Foundation & Composition

## 1. Project Inspection Summary

- **Runtime & Framework Stack**:
  - React: `^19.2.6`
  - React-DOM: `^19.2.6`
  - Three.js: `^0.184.0`
  - @react-three/fiber: `^9.8.2`
  - Vite: `^6.3.5`
  - ESLint: `^9.25.0`
- **Recoverable Checkpoint**:
  - Git branch: `backup/pre-phase-1`
  - Git tag: `checkpoint-pre-phase-1`
- **Reference Image Analysis**:
  - File: `C:/Users/kotas/.gemini/antigravity/brain/49eb2915-01c2-4dad-8f9d-59c81966a6e6/.user_uploaded/media_1794836719533_f5a6ddb1.jpg`
  - Resolution: 1024 x 341 pixels
  - Aspect Ratio: `3.0029:1` (~3:1 panoramic)
  - Color palette background: Near-pure black (`#000205` / `#000000`)
  - Composition layout:
    - Left formation region: ~39.5% of total width (left edge to ~39.5%)
    - Central negative space: ~21.0% of total width (strictly void, no geometry)
    - Right formation region: ~39.5% of total width (~60.5% to right edge)
    - Vertical extent: Formations are vertically centered around Y = 0, occupying ~65% of the total vertical height, leaving negative space top and bottom.
    - Depth range: Layered front-to-back along Z axis without perspective distortion.

---

## 2. Spatial Boundaries & Coordinate System

### Coordinate Axes
- **X Axis (Horizontal Progression)**:
  - Origin $X = 0$ is the exact geometric center of the scene.
  - Left formation: $X \in [-X_{\text{outer}}, -X_{\text{innerGap}}]$
  - Right formation: $X \in [X_{\text{innerGap}}, X_{\text{outer}}]$
  - Central exclusion zone: $X \in (-X_{\text{innerGap}}, X_{\text{innerGap}})$ where geometry is strictly prohibited.
- **Y Axis (Vertical Distribution)**:
  - Origin $Y = 0$ is the scene baseline.
  - Formations extend within $Y \in [-Y_{\text{extent}}, Y_{\text{extent}}]$.
- **Z Axis (Spatial Depth)**:
  - Positive Z faces camera ($+Z$), Negative Z recedes into depth ($-Z$).
  - Formation depth bounds: $Z \in [-Z_{\text{depth}}/2, Z_{\text{depth}}/2]$.

### Proportions (Target 3:1 Aspect)
- Total visible horizontal span at focal plane $Z = 0$: $W$
- Half width: $W_{\text{half}} = W / 2$
- Left formation width: $0.395 \times W$
- Central exclusion width: $0.210 \times W$ (radius $X_{\text{innerGap}} = 0.105 \times W = 0.210 \times W_{\text{half}}$)
- Right formation width: $0.395 \times W$
- Outer extent: $X_{\text{outer}} = W_{\text{half}} \times 1.02$ (allowing natural edge run-off)
- Inner gap half-width: $X_{\text{innerGap}} = W_{\text{half}} \times 0.210$
- Central exclusion span: $2 \times X_{\text{innerGap}} = 0.210 \times W = 21.0\%$ of width (fulfilling the 20–22% requirement)

---

## 3. Camera Framing & Viewport Adaptation

### Camera Configuration
- **Type**: `THREE.PerspectiveCamera`
- **Field of View (FOV)**: 34° vertical FOV (reference)
- **Position**: `[0, 0, 16]`
- **Target**: `[0, 0, 0]`
- **Clipping Planes**: Near = `0.1`, Far = `100`

### Responsive Composition Strategy
Support across 4 device tiers:
1. **Ultrawide** ($A \ge 2.3$, e.g. 3:1):
   - Native panoramic display.
   - Camera $Z = 16$, vertical FOV = 34°.
2. **Standard Desktop** ($1.55 \le A < 2.3$, e.g. 16:9, 16:10):
   - Intelligently adjust camera distance or horizontal FOV so that the full panoramic width and the central exclusion gap remain intact without horizontal clipping or distortion.
3. **Tablet** ($0.9 \le A < 1.55$, e.g. 4:3, 3:2):
   - Maintain spatial boundary ratios (39.5% left, 21% center, 39.5% right) and adjust camera framing to frame the panoramic formation with generous vertical negative space.
4. **Mobile** ($A < 0.9$, e.g. 9:16):
   - Preserve central negative space; adjust framing so the left and right formations remain distinct flanking wings without entering the central exclusion zone.

---

## 4. Canvas and Scene Foundation

- **Canvas Setup**:
  - React Three Fiber `<Canvas>` with proper sizing (`100%` width/height).
  - Background color: Near-pure black `#000205` / `#000000`.
  - Renderer config: antialiasing enabled, tone mapping disabled (`NoToneMapping`), power preference `high-performance`.
  - DPR: `Math.min(window.devicePixelRatio || 1, 2)` (performance-optimized).
- **Scene Hierarchy**:
  ```jsx
  <Canvas>
    <color attach="background" args={["#000205"]} />
    <PerspectiveCamera makeDefault position={[0, 0, 16]} fov={34} near={0.1} far={100} />
    <ResponsiveCameraManager />
    <group name="neural-wireframe-scene-root">
      {/* All 7 Architectural slots for future phases (Section 8) */}
      <group name="slot-depth-layers" />
      <group name="slot-primary-filaments" />
      <group name="slot-neural-connections" />
      <group name="slot-neural-nodes" />
      <group name="slot-particle-field" />
      <group name="slot-neural-wire-materials" />
      <group name="slot-animation-controller" />
    </group>
  </Canvas>
  ```
- **Strict Scope Guard**:
  - No filaments, no nodes, no particle field, no bloom, no lights, no animation.
  - Zero geometry rendered inside the central negative space.

---

## 5. Architectural Preparation & File Organization

Files to create / modify:
1. `src/spatialConfig.js`: Centralized spatial boundaries, coordinate system math, frustum calculations, and responsive tier definitions.
2. `src/NeuralSceneFoundation.jsx`: Core R3F scene component providing Canvas, camera, responsive controller, near-black background, and integration slots.
3. `src/NeuralWirePreview.jsx`: Container component managing stage sizing (3:1 aspect ratio or responsive container) and mounting the R3F Canvas.
4. `src/index.js`: Clean module exports for future phases.
5. `main.jsx`: Application entry point rendering `<NeuralWirePreview targetAspect={3.0} />`.
6. `verify_phase1.mjs`: Automated verification test suite validating:
   - Proportional boundaries (left 39.5%, center 21%, right 39.5%)
   - Strict exclusion of central negative space
   - Camera frustum calculations across all 4 responsive tiers
   - Coordinate consistency
