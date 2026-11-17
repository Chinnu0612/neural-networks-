import React, { useState, useEffect, useRef } from 'react';
import NeuralSceneFoundation from './NeuralSceneFoundation.jsx';
import {
  REFERENCE_ASPECT_RATIO,
  PROPORTIONS,
  computeSpatialBounds,
  getDeviceTier,
} from './spatialConfig.js';

/**
 * NeuralWirePreview
 * Top-level responsive preview container for the 3D Neural Wireframe scene.
 * Enforces the ~3:1 panoramic aspect ratio or full-viewport responsiveness.
 * 
 * Features:
 * - Interactive HUD with View Mode Toggle: [View: Animated Wireframes] / [View: Spatial Foundation Only]
 * - Spatial Guide Toggle: [Toggle Spatial Guide: ON/OFF]
 * - Glowing 3:1 stage boundary with ambient shadows
 * - Responsive camera framing across arbitrary viewports
 */
export function NeuralWirePreview({
  targetAspect = REFERENCE_ASPECT_RATIO,
  backgroundColor = '#000000',
  showSpatialGuide = true,
  initialViewMode = 'wireframes',
  className = '',
  style = {},
}) {
  const outerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 1024, height: 341 });
  const [stageSize, setStageSize] = useState({ width: 1024, height: 341 });
  const [deviceTier, setDeviceTier] = useState('ultrawide');
  const [spatialBounds, setSpatialBounds] = useState(() => computeSpatialBounds());

  // Mode Toggle: 'wireframes' (Animated Wireframes) vs 'foundation' (Spatial Foundation Only)
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'foundation' || params.get('wireframes') === '0') return 'foundation';
      if (params.get('mode') === 'wireframes' || params.get('wireframes') === '1') return 'wireframes';
    }
    return initialViewMode;
  });

  const [showHud, setShowHud] = useState(() => {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('hud') === '0' || params.get('clean') === '1') return false;
    }
    return true;
  });

  // Check URL query param for guide overlay:
  // Defaults to showSpatialGuide (true).
  // Can be explicitly disabled via ?guide=0 or ?clean=1.
  // Can be explicitly enabled via ?guide=1 or ?debug=1.
  const [enableGuide, setEnableGuide] = useState(() => {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('guide') === '0' || params.get('clean') === '1') return false;
      if (params.get('guide') === '1' || params.get('debug') === '1') return true;
    }
    return showSpatialGuide;
  });

  const prevPropRef = useRef(showSpatialGuide);
  useEffect(() => {
    if (prevPropRef.current !== showSpatialGuide) {
      prevPropRef.current = showSpatialGuide;
      setEnableGuide(showSpatialGuide);
    }
  }, [showSpatialGuide]);

  useEffect(() => {
    const outerEl = outerRef.current;

    const handleResize = () => {
      const outer = outerRef.current;
      const clientW = outer ? outer.clientWidth : (typeof window !== 'undefined' ? window.innerWidth : 1024);
      const clientH = outer ? outer.clientHeight : (typeof window !== 'undefined' ? window.innerHeight : 341);

      const availW = Math.max(clientW, 100);
      const availH = Math.max(clientH, 100);

      setContainerSize({ width: availW, height: availH });

      let stageW = availW;
      let stageH = availH;

      // When targetAspect is provided (> 0), letterbox stage to target aspect ratio
      // If targetAspect is null/false, fill container responsively
      if (targetAspect && typeof targetAspect === 'number' && targetAspect > 0) {
        stageH = Math.round(stageW / targetAspect);
        if (stageH > availH) {
          stageH = availH;
          stageW = Math.round(stageH * targetAspect);
        }
        if (stageW > availW) {
          stageW = availW;
          stageH = Math.round(stageW / targetAspect);
        }
      }

      setStageSize({ width: stageW, height: stageH });
      const viewportAspect = availW / Math.max(availH, 1);
      const currentTier = getDeviceTier(viewportAspect);
      setDeviceTier(currentTier);
    };

    handleResize();

    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && outerEl) {
      ro = new ResizeObserver(() => {
        handleResize();
      });
      ro.observe(outerEl);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
    };
  }, [targetAspect]);

  // Determine vertical positioning relationship:
  // When topLetterbox is large (>= 48px), HUD sits entirely in the letterbox space above the stage.
  // When topLetterbox is small (< 48px), HUD sits over the stage top and the guide requires padding.
  const topLetterbox = Math.max(0, (containerSize.height - stageSize.height) / 2);
  const hudOverlapsStage = topLetterbox < 48;
  const isNarrowScreen = containerSize.width < 560;
  const guideTopPadding = stageSize.height < 180
    ? '4px 6px'
    : (hudOverlapsStage ? (isNarrowScreen ? '64px 8px 8px 8px' : '48px 8px 8px 8px') : '12px');

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        width: '100%',
        height: '100vh',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        margin: 0,
        padding: 0,
        ...style,
      }}
    >
      {/* Persistent Responsive HUD Banner / Overlay */}
      {showHud && (
      <header
        role="region"
        aria-label="Scene Status HUD"
        style={{
          position: 'absolute',
          top: stageSize.height < 200 ? '4px' : (hudOverlapsStage ? '6px' : '10px'),
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'max-content',
          maxWidth: 'calc(100% - 16px)',
          zIndex: 40,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: stageSize.width < 640 ? '6px' : (stageSize.width <= 1080 ? '8px' : '12px'),
          padding: stageSize.width < 640 ? '3px 8px' : '4px 12px',
          background: 'rgba(0, 4, 12, 0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          borderRadius: '6px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.85), 0 0 16px rgba(0, 229, 255, 0.12)',
          fontFamily: 'monospace, "SF Mono", "Fira Code", Courier, monospace',
          fontSize: stageSize.width < 640 ? '9.5px' : (stageSize.width <= 1080 ? '10px' : '11px'),
          color: '#e2e8f0',
          boxSizing: 'border-box',
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
      >
        {/* Project Status */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#00e5ff',
              boxShadow: '0 0 8px #00e5ff',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <strong style={{ color: '#00e5ff', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
            Phase 1: Scene Foundation &amp; Spatial Bounds
          </strong>
        </div>

        <span style={{ color: 'rgba(255, 255, 255, 0.25)', userSelect: 'none' }}>|</span>

        {/* Proportions */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'rgba(26, 208, 255, 0.95)' }}>Left {(PROPORTIONS.LEFT_WIDTH_RATIO * 100).toFixed(1)}%</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>|</span>
          <span style={{ color: 'rgba(255, 100, 100, 0.95)' }}>Central Void {(PROPORTIONS.CENTRAL_EXCLUSION_RATIO * 100).toFixed(1)}%</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>|</span>
          <span style={{ color: 'rgba(26, 208, 255, 0.95)' }}>Right {(PROPORTIONS.RIGHT_WIDTH_RATIO * 100).toFixed(1)}%</span>
        </div>

        <span style={{ color: 'rgba(255, 255, 255, 0.25)', userSelect: 'none' }}>|</span>

        {/* Live Metrics: Device Tier, Stage Dimensions, Aspect Ratio */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
          <span>Tier: <strong style={{ color: '#fff' }}>{deviceTier}</strong></span>
          <span>Stage: <strong style={{ color: '#fff' }}>{stageSize.width}x{stageSize.height}</strong></span>
          <span>Aspect: <strong style={{ color: '#fff' }}>{(stageSize.width / Math.max(stageSize.height, 1)).toFixed(2)}:1</strong></span>
        </div>

        <span style={{ color: 'rgba(255, 255, 255, 0.25)', userSelect: 'none' }}>|</span>

        {/* Mode Toggle Button: [View: Animated Wireframes] / [View: Spatial Foundation Only] */}
        <button
          type="button"
          id="toggle-view-mode"
          aria-label="Toggle View Mode"
          aria-pressed={viewMode === 'wireframes'}
          onClick={() => {
            setViewMode((prev) => {
              const next = prev === 'wireframes' ? 'foundation' : 'wireframes';
              if (typeof window !== 'undefined' && window.history) {
                const url = new URL(window.location.href);
                url.searchParams.set('mode', next);
                window.history.replaceState(null, '', url.toString());
              }
              return next;
            });
          }}
          style={{
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: viewMode === 'wireframes' ? 'rgba(0, 229, 255, 0.16)' : 'rgba(255, 255, 255, 0.06)',
            color: viewMode === 'wireframes' ? '#00e5ff' : '#94a3b8',
            border: `1px solid ${viewMode === 'wireframes' ? 'rgba(0, 229, 255, 0.55)' : 'rgba(255, 255, 255, 0.2)'}`,
            padding: '3px 8px',
            borderRadius: '4px',
            fontFamily: 'inherit',
            fontSize: stageSize.width < 640 ? '9.5px' : (stageSize.width <= 1080 ? '10px' : '11px'),
            fontWeight: 600,
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
        >
          <span>
            {viewMode === 'wireframes' ? '[View: Animated Wireframes]' : '[View: Spatial Foundation Only]'}
          </span>
        </button>

        <span style={{ color: 'rgba(255, 255, 255, 0.25)', userSelect: 'none' }}>|</span>

        {/* Guide Toggle Button */}
        <button
          type="button"
          id="toggle-spatial-guide"
          aria-pressed={enableGuide}
          onClick={() => {
            setEnableGuide((prev) => {
              const next = !prev;
              if (typeof window !== 'undefined' && window.history) {
                const url = new URL(window.location.href);
                url.searchParams.set('guide', next ? '1' : '0');
                window.history.replaceState(null, '', url.toString());
              }
              return next;
            });
          }}
          style={{
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: enableGuide ? 'rgba(0, 229, 255, 0.16)' : 'rgba(255, 255, 255, 0.06)',
            color: enableGuide ? '#00e5ff' : '#94a3b8',
            border: `1px solid ${enableGuide ? 'rgba(0, 229, 255, 0.55)' : 'rgba(255, 255, 255, 0.2)'}`,
            padding: '3px 8px',
            borderRadius: '4px',
            fontFamily: 'inherit',
            fontSize: stageSize.width < 640 ? '9.5px' : (stageSize.width <= 1080 ? '10px' : '11px'),
            fontWeight: 600,
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
        >
          <span>Toggle Spatial Guide</span>
          <span
            style={{
              padding: '1px 5px',
              borderRadius: '3px',
              background: enableGuide ? 'rgba(0, 229, 255, 0.3)' : 'rgba(255, 255, 255, 0.12)',
              color: enableGuide ? '#ffffff' : '#94a3b8',
              fontSize: '9px',
            }}
          >
            {enableGuide ? 'ON' : 'OFF'}
          </span>
        </button>
      </header>
      )}

      {/* 3:1 Panoramic Stage with subtle border and ambient glow */}
      <div
        data-testid="neural-stage"
        style={{
          width: `${stageSize.width}px`,
          height: `${stageSize.height}px`,
          maxWidth: '100%',
          maxHeight: '100%',
          minWidth: 0,
          minHeight: 0,
          flexShrink: 0,
          position: 'relative',
          backgroundColor,
          overflow: 'hidden',
          boxSizing: 'border-box',
          border: '1px solid rgba(0, 229, 255, 0.35)',
          borderRadius: '4px',
          boxShadow: '0 0 25px rgba(0, 229, 255, 0.16), 0 0 60px rgba(0, 160, 255, 0.08), 0 8px 32px rgba(0, 0, 0, 0.85)',
        }}
      >
        <NeuralSceneFoundation
          backgroundColor={backgroundColor}
          enableWireframes={viewMode === 'wireframes'}
          onBoundsChange={setSpatialBounds}
        />

        {/* Spatial Guide Overlay for composition verification */}
        {enableGuide && (
          <div
            data-testid="spatial-guide-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              display: 'flex',
              zIndex: 10,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxSizing: 'border-box',
            }}
          >
            {/* Left Formation Region (~39.5%) */}
            <div
              style={{
                width: `${PROPORTIONS.LEFT_WIDTH_RATIO * 100}%`,
                height: '100%',
                borderRight: '1px dashed rgba(26, 208, 255, 0.4)',
                backgroundColor: 'rgba(26, 208, 255, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: guideTopPadding,
                color: 'rgba(26, 208, 255, 0.85)',
                fontFamily: 'monospace',
                fontSize: stageSize.height < 180 ? '9px' : '11px',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>LEFT ({(PROPORTIONS.LEFT_WIDTH_RATIO * 100).toFixed(1)}%)</span>
              <span style={{ whiteSpace: 'nowrap', opacity: 0.8 }}>[{spatialBounds.leftRegion.xMin.toFixed(2)}, {spatialBounds.leftRegion.xMax.toFixed(2)}]</span>
            </div>

            {/* Central Exclusion Zone (~21.0%) */}
            <div
              style={{
                width: `${PROPORTIONS.CENTRAL_EXCLUSION_RATIO * 100}%`,
                height: '100%',
                borderRight: '1px dashed rgba(255, 60, 60, 0.4)',
                backgroundColor: 'rgba(255, 0, 0, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: stageSize.height < 180 ? '4px' : '8px',
                color: 'rgba(255, 100, 100, 0.85)',
                fontFamily: 'monospace',
                fontSize: stageSize.height < 180 ? '9px' : '11px',
                textAlign: 'center',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <span style={{ fontWeight: 'bold', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                EXCLUSION
              </span>
              <span style={{ opacity: 0.8, marginTop: '2px', whiteSpace: 'nowrap' }}>
                {(PROPORTIONS.CENTRAL_EXCLUSION_RATIO * 100).toFixed(1)}% Negative
              </span>
              <span style={{ opacity: 0.6, fontSize: stageSize.height < 180 ? '8px' : '10px', marginTop: '1px', whiteSpace: 'nowrap' }}>
                [{spatialBounds.centralExclusion.xMin.toFixed(2)}, {spatialBounds.centralExclusion.xMax.toFixed(2)}]
              </span>
            </div>

            {/* Right Formation Region (~39.5%) */}
            <div
              style={{
                width: `${PROPORTIONS.RIGHT_WIDTH_RATIO * 100}%`,
                height: '100%',
                backgroundColor: 'rgba(26, 208, 255, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                padding: guideTopPadding,
                color: 'rgba(26, 208, 255, 0.85)',
                fontFamily: 'monospace',
                fontSize: stageSize.height < 180 ? '9px' : '11px',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>RIGHT ({(PROPORTIONS.RIGHT_WIDTH_RATIO * 100).toFixed(1)}%)</span>
              <span style={{ whiteSpace: 'nowrap', opacity: 0.8 }}>[{spatialBounds.rightRegion.xMin.toFixed(2)}, {spatialBounds.rightRegion.xMax.toFixed(2)}]</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NeuralWirePreview;
