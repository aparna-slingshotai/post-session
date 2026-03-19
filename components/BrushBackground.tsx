"use client";

import { useEffect, useRef } from "react";

// Ash Align palette — earthy tones that complement the design system
const DEFAULT_PALETTE = [
  "#2c695a",
  "#7c843d",
  "#AD7049",
  "#8B9A7B",
  "#648675",
  "#C4B39A",
];

// Subtle split: top stream leans green/olive, bottom leans warm/brown
const TOP_PALETTE = ["#2c695a", "#7c843d", "#8B9A7B", "#648675"];
const BOTTOM_PALETTE = ["#AD7049", "#C4B39A", "#7c843d", "#8B9A7B"];

interface BrushBackgroundProps {
  palette?: string[];
  variant?: "flow" | "alignment";
}

export default function BrushBackground({
  palette = DEFAULT_PALETTE,
  variant = "flow",
}: BrushBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    function loadScript(src: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(
          `script[src="${src}"]`
        ) as HTMLScriptElement | null;
        if (existing) {
          // If already loaded, resolve immediately
          if (existing.dataset.loaded === "true") {
            resolve();
            return;
          }
          // If still loading, wait for it
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => {
          script.dataset.loaded = "true";
          resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    }

    // Yield to main thread so the UI is interactive before heavy rendering.
    // Uses setTimeout to guarantee the browser can process pending events
    // (clicks, paints) before we start CPU-heavy canvas work.
    function yieldToMain(): Promise<void> {
      return new Promise((resolve) => {
        setTimeout(resolve, 80);
      });
    }

    async function init() {
      // Let React hydrate and paint first
      await yieldToMain();
      if (cancelled) return;

      try {
        await loadScript(
          "https://cdnjs.cloudflare.com/ajax/libs/p5.js/2.0.1/p5.min.js"
        );
        await loadScript(
          "https://cdn.jsdelivr.net/npm/p5.brush@2.0.0-beta"
        );
      } catch (err) {
        console.error("[BrushBackground] Script load error:", err);
        return;
      }

      // Yield again after scripts load so UI stays responsive
      await yieldToMain();
      if (cancelled) return;

      if (cancelled || !container) return;

      const p5Constructor = (window as any).p5;
      const brushLib = (window as any).brush;
      if (!p5Constructor || !brushLib) {
        console.error("[BrushBackground] Missing globals - p5:", !!p5Constructor, "brush:", !!brushLib);
        return;
      }

      // ========================================================
      // ALIGNMENT VARIANT
      // Two streams of flow lines — top and bottom — that swirl
      // toward the center and interweave. A visual metaphor for
      // two people finding alignment.
      // ========================================================
      const alignmentSketch = (p: any) => {
        brushLib.instance(p);

        p.setup = () => {
          const w = container.offsetWidth;
          const h = container.offsetHeight;
          const canvas = p.createCanvas(w, h, p.WEBGL);
          canvas.parent(container);
          p.angleMode(p.RADIANS);
          brushLib.load();
          brushLib.scaleBrushes(1.5);
          p.translate(-w / 2, -h / 2);

          p.randomSeed(42);
          p.noiseSeed(42);
          p.background("#ebe7de");

          const noiseScale = 0.004;
          const segmentLen = 2.5;
          const centerY = h / 2;
          const centerX = w / 2;

          // ----------------------------------------------------------
          // Trace a single particle path through the convergence field.
          //
          // The angle at each step blends:
          //   - Perlin noise (organic variation)
          //   - A gravitational pull toward the canvas center
          //
          // pullStrength is high near the edges (lines flow inward)
          // and fades to near-zero at the center (noise takes over,
          // creating the swirl zone where the two streams interweave).
          // ----------------------------------------------------------
          function tracePath(
            startX: number,
            startY: number,
            maxSteps: number,
            fromTop: boolean
          ): [number, number][] {
            let cx = startX;
            let cy = startY;
            const pts: [number, number][] = [[cx, cy]];

            for (let s = 0; s < maxSteps; s++) {
              // Perlin noise angle
              const noiseAngle =
                p.noise(cx * noiseScale, cy * noiseScale, fromTop ? 0 : 3.7) *
                p.TWO_PI;

              // Gravitational pull toward center
              // The 0.15 on x makes the pull mostly vertical —
              // lines converge vertically but keep horizontal spread,
              // so the meeting zone is a wide band, not a point.
              const pullAngle = Math.atan2(
                centerY - cy,
                (centerX - cx) * 0.15
              );

              // Pull strength: strong at edges, fading toward center
              const distFromCenter = Math.abs(cy - centerY) / (h / 2);
              // Cubic falloff — pull dies off quickly near center
              const pullStr = distFromCenter * distFromCenter * 0.7;

              // Blend noise and pull
              // Use circular interpolation to avoid angle wrapping artifacts
              let diff = noiseAngle - pullAngle;
              while (diff > Math.PI) diff -= p.TWO_PI;
              while (diff < -Math.PI) diff += p.TWO_PI;
              const angle = pullAngle + diff * (1 - pullStr);

              cx += segmentLen * Math.cos(angle);
              cy += segmentLen * Math.sin(angle);

              // Allow lines to travel past center and curve back
              // (creating loops) — only stop if well off-screen
              if (cx < -40 || cx > w + 40 || cy < -40 || cy > h + 40) break;

              pts.push([cx, cy]);
            }

            return pts;
          }

          // Convert a traced path to spline control points
          function toControlPoints(
            pts: [number, number][],
            maxCtrl: number
          ): [number, number][] | null {
            if (pts.length < 6) return null;
            const step = Math.max(1, Math.floor(pts.length / maxCtrl));
            const ctrl: [number, number][] = [];
            for (let j = 0; j < pts.length; j += step) {
              ctrl.push(pts[j]);
            }
            const last = pts[pts.length - 1];
            if (
              ctrl[ctrl.length - 1][0] !== last[0] ||
              ctrl[ctrl.length - 1][1] !== last[1]
            ) {
              ctrl.push(last);
            }
            return ctrl.length >= 3 ? ctrl : null;
          }

          // --- Layer 1: Soft watercolor wash ---
          brushLib.noStroke();
          brushLib.noHatch();

          // Top wash — cooler
          for (let i = 0; i < 5; i++) {
            brushLib.fill(p.random(TOP_PALETTE), p.random(12, 25));
            brushLib.fillBleed(p.random(0.3, 0.6), "out");
            brushLib.fillTexture(p.random(0.2, 0.4), p.random(0.1, 0.2));
            brushLib.circle(
              p.random(w * 0.1, w * 0.9),
              p.random(0, h * 0.4),
              p.random(w * 0.15, w * 0.35)
            );
          }

          // Bottom wash — warmer
          for (let i = 0; i < 5; i++) {
            brushLib.fill(p.random(BOTTOM_PALETTE), p.random(12, 25));
            brushLib.fillBleed(p.random(0.3, 0.6), "out");
            brushLib.fillTexture(p.random(0.2, 0.4), p.random(0.1, 0.2));
            brushLib.circle(
              p.random(w * 0.1, w * 0.9),
              p.random(h * 0.6, h),
              p.random(w * 0.15, w * 0.35)
            );
          }

          // Center meeting wash — blended
          for (let i = 0; i < 4; i++) {
            brushLib.fill(p.random(palette), p.random(10, 20));
            brushLib.fillBleed(p.random(0.4, 0.7), "out");
            brushLib.fillTexture(p.random(0.2, 0.5), p.random(0.1, 0.3));
            brushLib.circle(
              p.random(w * 0.2, w * 0.8),
              p.random(h * 0.35, h * 0.65),
              p.random(w * 0.1, w * 0.3)
            );
          }

          // --- Layer 2: Flow lines ---
          brushLib.noFill();
          brushLib.noHatch();
          brushLib.noField();

          const lightBrushes = ["pen", "rotring", "2H", "cpencil", "HB"];
          const boldBrushes = ["charcoal", "2B", "marker"];
          const isMobile = w < 768;
          const linesPerStream = isMobile ? 80 : 200;
          const stepsPerLine = isMobile ? 80 : 120;

          // Top stream: spawn along the top edge, spread across x
          for (let i = 0; i < linesPerStream; i++) {
            const sx = p.random(-w * 0.1, w * 1.1);
            const sy = p.random(-h * 0.05, h * 0.15);
            const pts = tracePath(sx, sy, stepsPerLine, true);
            const ctrl = toControlPoints(pts, 22);
            if (!ctrl) continue;

            brushLib.set(
              p.random(lightBrushes),
              p.random(TOP_PALETTE),
              p.random(0.15, 0.5)
            );
            brushLib.spline(ctrl, 0.6);
          }

          // Bottom stream: spawn along the bottom edge
          for (let i = 0; i < linesPerStream; i++) {
            const sx = p.random(-w * 0.1, w * 1.1);
            const sy = p.random(h * 0.85, h * 1.05);
            const pts = tracePath(sx, sy, stepsPerLine, false);
            const ctrl = toControlPoints(pts, 22);
            if (!ctrl) continue;

            brushLib.set(
              p.random(lightBrushes),
              p.random(BOTTOM_PALETTE),
              p.random(0.15, 0.5)
            );
            brushLib.spline(ctrl, 0.6);
          }

          // --- Layer 3: Bold accent rivers through the meeting zone ---
          const numAccents = isMobile ? 10 : 25;
          for (let i = 0; i < numAccents; i++) {
            const fromTop = i < Math.ceil(numAccents / 2);
            const sx = p.random(w * 0.1, w * 0.9);
            const sy = fromTop
              ? p.random(0, h * 0.2)
              : p.random(h * 0.8, h);
            const pts = tracePath(sx, sy, stepsPerLine * 1.8, fromTop);
            const ctrl = toControlPoints(pts, 18);
            if (!ctrl) continue;

            brushLib.set(
              p.random(boldBrushes),
              p.random(fromTop ? TOP_PALETTE : BOTTOM_PALETTE),
              p.random(0.5, 0.9)
            );
            brushLib.spline(ctrl, 0.65);
          }

          // --- Layer 4: Fine detail lines in the meeting zone ---
          const numDetails = isMobile ? 20 : 60;
          for (let i = 0; i < numDetails; i++) {
            const cx = p.random(w * 0.15, w * 0.85);
            const cy = p.random(h * 0.3, h * 0.7);
            const noiseAngle =
              p.noise(cx * noiseScale, cy * noiseScale) * p.TWO_PI;
            const len = p.random(15, 45);
            brushLib.set("2H", p.random(palette), p.random(0.1, 0.25));
            brushLib.line(
              cx,
              cy,
              cx + Math.cos(noiseAngle) * len,
              cy + Math.sin(noiseAngle) * len
            );
          }

          p.noLoop();
        };

        p.draw = () => {};
      };

      // ========================================================
      // FLOW VARIANT (loading screens — unchanged)
      // Standard Perlin noise flow field
      // ========================================================
      const flowSketch = (p: any) => {
        brushLib.instance(p);

        p.setup = () => {
          const w = container.offsetWidth;
          const h = container.offsetHeight;
          const canvas = p.createCanvas(w, h, p.WEBGL);
          canvas.parent(container);
          p.angleMode(p.RADIANS);
          brushLib.load();
          brushLib.scaleBrushes(1.5);
          p.translate(-w / 2, -h / 2);

          p.randomSeed(42);
          p.noiseSeed(42);
          p.background("#ebe7de");

          const noiseScale = 0.005;
          const segmentLength = 3;
          const isMobileFlow = w < 768;
          const numLines = isMobileFlow ? 200 : 500;
          const stepsPerLine = isMobileFlow ? 50 : 80;

          // Watercolor wash
          brushLib.noStroke();
          brushLib.noHatch();
          for (let i = 0; i < 10; i++) {
            brushLib.fill(p.random(palette), p.random(15, 30));
            brushLib.fillBleed(p.random(0.3, 0.7), "out");
            brushLib.fillTexture(p.random(0.2, 0.5), p.random(0.1, 0.3));
            brushLib.circle(
              p.random(0, w),
              p.random(0, h),
              p.random(w * 0.15, w * 0.4)
            );
          }

          // Main flow lines
          brushLib.noFill();
          brushLib.noHatch();
          brushLib.noField();

          const brushTypes = ["pen", "rotring", "2H", "cpencil", "HB"];

          for (let i = 0; i < numLines; i++) {
            let cx = p.random(w);
            let cy = p.random(h);
            const points: [number, number][] = [[cx, cy]];

            for (let s = 0; s < stepsPerLine; s++) {
              const angle = p.map(
                p.noise(cx * noiseScale, cy * noiseScale),
                0.0, 1.0, 0.0, p.TWO_PI
              );
              cx += segmentLength * Math.cos(angle);
              cy += segmentLength * Math.sin(angle);
              if (cx < -20 || cx > w + 20 || cy < -20 || cy > h + 20) break;
              points.push([cx, cy]);
            }

            if (points.length < 4) continue;

            const maxCtrl = 20;
            const step = Math.max(1, Math.floor(points.length / maxCtrl));
            const ctrl: [number, number][] = [];
            for (let j = 0; j < points.length; j += step) {
              ctrl.push(points[j]);
            }
            const last = points[points.length - 1];
            if (
              ctrl[ctrl.length - 1][0] !== last[0] ||
              ctrl[ctrl.length - 1][1] !== last[1]
            ) {
              ctrl.push(last);
            }
            if (ctrl.length < 3) continue;

            brushLib.set(
              p.random(brushTypes),
              p.random(palette),
              p.random(0.2, 0.6)
            );
            brushLib.spline(ctrl, 0.6);
          }

          // Bold accent rivers
          const accentBrushes = ["charcoal", "2B", "marker"];
          const numFlowAccents = isMobileFlow ? 20 : 50;
          for (let i = 0; i < numFlowAccents; i++) {
            let cx = p.random(w);
            let cy = p.random(h);
            const points: [number, number][] = [[cx, cy]];

            for (let s = 0; s < stepsPerLine * 2; s++) {
              const angle = p.map(
                p.noise(cx * noiseScale, cy * noiseScale),
                0.0, 1.0, 0.0, p.TWO_PI
              );
              cx += segmentLength * Math.cos(angle);
              cy += segmentLength * Math.sin(angle);
              if (cx < -20 || cx > w + 20 || cy < -20 || cy > h + 20) break;
              points.push([cx, cy]);
            }

            if (points.length < 6) continue;
            const step = Math.max(1, Math.floor(points.length / 16));
            const ctrl: [number, number][] = [];
            for (let j = 0; j < points.length; j += step) {
              ctrl.push(points[j]);
            }
            ctrl.push(points[points.length - 1]);
            if (ctrl.length < 3) continue;

            brushLib.set(
              p.random(accentBrushes),
              p.random(palette),
              p.random(0.5, 1.0)
            );
            brushLib.spline(ctrl, 0.65);
          }

          // Fine pencil detail
          const numFlowDetails = isMobileFlow ? 30 : 100;
          for (let i = 0; i < numFlowDetails; i++) {
            let cx = p.random(w);
            let cy = p.random(h);
            const angle = p.map(
              p.noise(cx * noiseScale, cy * noiseScale),
              0.0, 1.0, 0.0, p.TWO_PI
            );
            const len = p.random(20, 60);
            brushLib.set("2H", p.random(palette), p.random(0.1, 0.3));
            brushLib.line(
              cx, cy,
              cx + Math.cos(angle) * len,
              cy + Math.sin(angle) * len
            );
          }

          p.noLoop();
        };

        p.draw = () => {};
      };

      const chosenSketch =
        variant === "alignment" ? alignmentSketch : flowSketch;

      let instance: any;
      try {
        instance = new p5Constructor(chosenSketch);
      } catch (err) {
        console.error("[BrushBackground] p5 sketch error:", err);
        return;
      }

      let resizeTimeout: ReturnType<typeof setTimeout>;
      const debouncedResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (!container) return;
          instance.remove();
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
          const newInstance = new p5Constructor(chosenSketch);
          cleanupRef.current = () => {
            clearTimeout(resizeTimeout);
            window.removeEventListener("resize", debouncedResize);
            newInstance.remove();
          };
        }, 300);
      };

      window.addEventListener("resize", debouncedResize);
      cleanupRef.current = () => {
        clearTimeout(resizeTimeout);
        window.removeEventListener("resize", debouncedResize);
        instance.remove();
      };
    }

    init();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [palette, variant]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    />
  );
}
