import { useEffect, useRef } from "react";
import styles from "./Background.module.css";

// Denser, finer dot grid specifications
const GRID_SPACING = 16;
const BASE_DOT_RADIUS = 1.05;
const MAX_DOT_RADIUS = 2.6;
const PARALLAX_FACTOR = 0.28; // Smooth, restrained upward scroll ratio

// Wave & Trail physical constants
const MAX_TRAIL_AGE = 700; // ms lifetime of a trail/wave impulse
const WAVE_SPEED = 150; // px per second propagation speed
const WAVE_WIDTH = 36; // px thickness of wavecrest
const MAX_WAVE_RADIUS = 125; // max radius wave propagates before dying
const TRAIL_RADIUS = 52; // localized wake radius directly under pointer
const MIN_SAMPLE_DIST = 6; // min px movement to register new trail point

export default function Background() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId = null;
    let isRunning = false;
    let isTouch = window.matchMedia("(hover: none)").matches;
    let prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Viewport dimensions
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Pointer history buffer: Array of { x, y, time }
    const trail = [];
    let lastRecordedPos = { x: -9999, y: -9999 };

    // Scroll state
    let scrollY = window.scrollY || 0;
    let isDirty = true;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      isDirty = true;
      requestDraw();
    }

    function addTrailPoint(x, y) {
      const now = performance.now();
      const dx = x - lastRecordedPos.x;
      const dy = y - lastRecordedPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= MIN_SAMPLE_DIST) {
        // Interpolate intermediate point for fast sweeps to keep wave continuous
        if (dist > 22 && lastRecordedPos.x > -1000) {
          trail.push({
            x: lastRecordedPos.x + dx * 0.5,
            y: lastRecordedPos.y + dy * 0.5,
            time: now - 8,
          });
        }

        trail.push({ x, y, time: now });
        lastRecordedPos = { x, y };

        // Keep trail buffer bounded
        if (trail.length > 35) {
          trail.splice(0, trail.length - 35);
        }

        requestDraw();
      }
    }

    function draw() {
      const now = performance.now();

      // Prune expired trail impulses
      while (trail.length > 0 && now - trail[0].time > MAX_TRAIL_AGE) {
        trail.shift();
      }

      ctx.clearRect(0, 0, width, height);

      // Parallax scroll calculation
      const scrollOffset = prefersReducedMotion ? 0 : (scrollY * PARALLAX_FACTOR) % GRID_SPACING;
      const startY = (-scrollOffset + GRID_SPACING) % GRID_SPACING - GRID_SPACING;

      const numCols = Math.ceil(width / GRID_SPACING) + 1;
      const numRows = Math.ceil(height / GRID_SPACING) + 2;

      // Check if any trail impulse is active
      const hasActiveTrail = !isTouch && !prefersReducedMotion && trail.length > 0;

      // Compute bounding box of active interaction to skip distance math on distant dots
      let bboxMinX = 99999, bboxMaxX = -99999, bboxMinY = 99999, bboxMaxY = -99999;
      if (hasActiveTrail) {
        for (let i = 0; i < trail.length; i++) {
          const p = trail[i];
          if (p.x < bboxMinX) bboxMinX = p.x;
          if (p.x > bboxMaxX) bboxMaxX = p.x;
          if (p.y < bboxMinY) bboxMinY = p.y;
          if (p.y > bboxMaxY) bboxMaxY = p.y;
        }
        bboxMinX -= MAX_WAVE_RADIUS;
        bboxMaxX += MAX_WAVE_RADIUS;
        bboxMinY -= MAX_WAVE_RADIUS;
        bboxMaxY += MAX_WAVE_RADIUS;
      }

      // High-performance batched drawing arrays
      // Baseline undisturbed dots are drawn in a single path
      ctx.beginPath();
      ctx.fillStyle = "rgba(182, 168, 228, 0.42)";

      const disturbedDots = [];

      for (let r = 0; r <= numRows; r++) {
        const y = startY + r * GRID_SPACING;
        if (y < -BASE_DOT_RADIUS || y > height + BASE_DOT_RADIUS) continue;

        const yInBbox = hasActiveTrail && y >= bboxMinY && y <= bboxMaxY;

        for (let c = 0; c <= numCols; c++) {
          const x = c * GRID_SPACING;
          if (x < -BASE_DOT_RADIUS || x > width + BASE_DOT_RADIUS) continue;

          let maxEffect = 0;

          if (yInBbox && x >= bboxMinX && x <= bboxMaxX) {
            // Evaluate wave and wake influence from recent trail points
            for (let i = trail.length - 1; i >= 0; i--) {
              const p = trail[i];
              const age = now - p.time;
              if (age > MAX_TRAIL_AGE) continue;

              const dx = x - p.x;
              const dy = y - p.y;
              const distSq = dx * dx + dy * dy;

              // Quick circle bounding rejection
              if (distSq > MAX_WAVE_RADIUS * MAX_WAVE_RADIUS) continue;

              const dist = Math.sqrt(distSq);
              const ageRatio = age / MAX_TRAIL_AGE; // 0 to 1
              const timeFade = 1 - ageRatio;

              // 1. Direct smooth wake under and close behind the cursor
              let wakeEffect = 0;
              if (dist < TRAIL_RADIUS) {
                const wakeFalloff = 1 - dist / TRAIL_RADIUS;
                wakeEffect = wakeFalloff * wakeFalloff * timeFade * 0.95;
              }

              // 2. Propagating ripple wave radiating outward from this point
              let waveEffect = 0;
              const waveFront = (age / 1000) * WAVE_SPEED;
              const distFromCrest = Math.abs(dist - waveFront);

              if (distFromCrest < WAVE_WIDTH) {
                const waveShape = Math.cos((distFromCrest / WAVE_WIDTH) * (Math.PI / 2));
                const spatialDecay = 1 - dist / MAX_WAVE_RADIUS;
                waveEffect = waveShape * waveShape * spatialDecay * timeFade * 0.9;
              }

              const combined = Math.max(wakeEffect, waveEffect);
              if (combined > maxEffect) {
                maxEffect = combined;
                if (maxEffect >= 0.98) break; // saturated
              }
            }
          }

          if (maxEffect > 0.02) {
            // Disturbed dot influenced by trail or wave
            const radius = BASE_DOT_RADIUS + (MAX_DOT_RADIUS - BASE_DOT_RADIUS) * maxEffect;
            const alpha = 0.40 + 0.55 * maxEffect;
            const rVal = Math.round(172 + (230 - 172) * maxEffect);
            const gVal = Math.round(156 + (210 - 156) * maxEffect);
            const bVal = Math.round(212 + (255 - 212) * maxEffect);

            disturbedDots.push({ x, y, radius, rVal, gVal, bVal, alpha });
          } else {
            // Undisturbed baseline dot -> append to batched path
            ctx.moveTo(x + BASE_DOT_RADIUS, y);
            ctx.arc(x, y, BASE_DOT_RADIUS, 0, Math.PI * 2);
          }
        }
      }

      // Render all thousands of baseline dots in a single GPU call
      ctx.fill();

      // Render perturbed dots with individual wave size and chromatic glow
      for (let i = 0; i < disturbedDots.length; i++) {
        const d = disturbedDots[i];
        ctx.beginPath();
        ctx.fillStyle = `rgba(${d.rVal}, ${d.gVal}, ${d.bVal}, ${d.alpha.toFixed(3)})`;
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Continue animation loop if trail is still actively decaying; otherwise sleep
      if (hasActiveTrail || isDirty) {
        isDirty = false;
        animId = requestAnimationFrame(draw);
      } else {
        isRunning = false;
      }
    }

    function requestDraw() {
      isDirty = true;
      if (!isRunning) {
        isRunning = true;
        animId = requestAnimationFrame(draw);
      }
    }

    function handlePointerMove(e) {
      if (isTouch) return;
      addTrailPoint(e.clientX, e.clientY);
    }

    function handlePointerLeave() {
      lastRecordedPos = { x: -9999, y: -9999 };
      // Do not abruptly clear: let remaining trail and ripples gracefully dissipate
      requestDraw();
    }

    function handleScroll() {
      scrollY = window.scrollY || 0;
      requestDraw();
    }

    function handleMediaChange() {
      isTouch = window.matchMedia("(hover: none)").matches;
      prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestDraw();
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        requestDraw();
      }
    }

    // Media query listeners
    const hoverMedia = window.matchMedia("(hover: none)");
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    hoverMedia.addEventListener?.("change", handleMediaChange);
    motionMedia.addEventListener?.("change", handleMediaChange);

    // Event listeners
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("mouseleave", handlePointerLeave, { passive: true });
    window.addEventListener("blur", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initial setup
    resize();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      hoverMedia.removeEventListener?.("change", handleMediaChange);
      motionMedia.removeEventListener?.("change", handleMediaChange);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handlePointerLeave);
      window.removeEventListener("blur", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className={styles.backgroundContainer} aria-hidden="true">
      <div className={styles.arcGradient}>
        <div className={styles.arcLine} />
      </div>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
