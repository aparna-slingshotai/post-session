"use client";

import { useEffect, useRef } from "react";

interface FlowBackgroundProps {
  className?: string;
}

const CONTOUR_COLORS = ["#7c843d", "#648675", "#8B9A7B", "#AD7049", "#9a6b4a"];

export default function FlowBackground({ className }: FlowBackgroundProps) {
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
          if (existing.dataset.loaded === "true") {
            resolve();
            return;
          }
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener(
            "error",
            () => reject(new Error(`Failed to load ${src}`)),
            { once: true }
          );
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

    async function init() {
      await new Promise((r) => setTimeout(r, 60));
      if (cancelled) return;

      try {
        await loadScript(
          "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js"
        );
      } catch (err) {
        console.error("[FlowBackground] p5.js load error:", err);
        return;
      }

      if (cancelled || !container) return;

      const p5Constructor = (window as any).p5;
      if (!p5Constructor) return;

      const sketch = (p: any) => {
        function hexToRgb(hex: string) {
          return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16),
          };
        }

        // Marching squares edge table.
        // Case index = NW*8 + NE*4 + SE*2 + SW*1 (1 = above threshold).
        // Edges: 0=N (top), 1=E (right), 2=S (bottom), 3=W (left).
        const EDGE_TABLE: [number, number][][] = [
          [],             // 0
          [[3, 2]],       // 1
          [[2, 1]],       // 2
          [[3, 1]],       // 3
          [[0, 1]],       // 4
          [[3, 0], [2, 1]], // 5 (saddle)
          [[0, 2]],       // 6
          [[3, 0]],       // 7
          [[0, 3]],       // 8
          [[0, 2]],       // 9
          [[0, 1], [3, 2]], // 10 (saddle)
          [[0, 1]],       // 11
          [[3, 1]],       // 12
          [[2, 1]],       // 13
          [[3, 2]],       // 14
          [],             // 15
        ];

        let bgR = 235, bgG = 231, bgB = 222;
        const cellSize = 8;
        const nScale = 0.007;
        const numLevels = 24;
        const timeSpeed = 0.0006;
        let cols = 0;
        let rows = 0;
        let field: Float32Array[] = [];
        let strokeColors: { r: number; g: number; b: number; major: boolean }[] = [];

        p.setup = () => {
          const raw = getComputedStyle(container)
            .getPropertyValue("--surface-bg")
            .trim();
          if (raw.startsWith("#") && raw.length >= 7) {
            const c = hexToRgb(raw);
            bgR = c.r; bgG = c.g; bgB = c.b;
          }

          const w = container.offsetWidth;
          const h = container.offsetHeight;
          const canvas = p.createCanvas(w, h);
          canvas.parent(container);

          p.noiseSeed(42);
          p.frameRate(15);

          cols = Math.ceil(w / cellSize) + 2;
          rows = Math.ceil(h / cellSize) + 2;
          field = new Array(rows);
          for (let j = 0; j < rows; j++) {
            field[j] = new Float32Array(cols);
          }

          const colors = CONTOUR_COLORS.map(hexToRgb);
          strokeColors = [];
          for (let l = 1; l <= numLevels; l++) {
            const isMajor = l % 5 === 0;
            const col = colors[l % colors.length];
            const blend = isMajor ? 0.55 : 0.3;
            strokeColors.push({
              r: bgR + (col.r - bgR) * blend,
              g: bgG + (col.g - bgG) * blend,
              b: bgB + (col.b - bgB) * blend,
              major: isMajor,
            });
          }
        };

        p.draw = () => {
          p.background(bgR, bgG, bgB);
          p.noFill();

          const t = p.frameCount * timeSpeed;

          let minV = Infinity, maxV = -Infinity;
          for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
              const nx = i * cellSize * nScale;
              const ny = j * cellSize * nScale;
              const v =
                p.noise(nx, ny, t) +
                0.35 * p.noise(nx * 2.5 + 100, ny * 2.5 + 100, t * 1.5);
              field[j][i] = v;
              if (v < minV) minV = v;
              if (v > maxV) maxV = v;
            }
          }

          const range = maxV - minV || 1;
          for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
              field[j][i] = (field[j][i] - minV) / range;
            }
          }

          function edgePoint(
            edge: number,
            i: number,
            j: number,
            nw: number,
            ne: number,
            se: number,
            sw: number,
            threshold: number
          ): [number, number] {
            let tp: number;
            switch (edge) {
              case 0:
                tp = (threshold - nw) / (ne - nw);
                return [(i + tp) * cellSize, j * cellSize];
              case 1:
                tp = (threshold - ne) / (se - ne);
                return [(i + 1) * cellSize, (j + tp) * cellSize];
              case 2:
                tp = (threshold - sw) / (se - sw);
                return [(i + tp) * cellSize, (j + 1) * cellSize];
              case 3:
                tp = (threshold - nw) / (sw - nw);
                return [i * cellSize, (j + tp) * cellSize];
              default:
                return [0, 0];
            }
          }

          for (let l = 0; l < numLevels; l++) {
            const threshold = (l + 1) / (numLevels + 1);
            const sc = strokeColors[l];
            p.stroke(sc.r, sc.g, sc.b);
            p.strokeWeight(sc.major ? 1.2 : 0.6);

            for (let j = 0; j < rows - 1; j++) {
              for (let i = 0; i < cols - 1; i++) {
                const nw = field[j][i];
                const ne = field[j][i + 1];
                const se = field[j + 1][i + 1];
                const sw = field[j + 1][i];

                const caseIdx =
                  (nw >= threshold ? 8 : 0) |
                  (ne >= threshold ? 4 : 0) |
                  (se >= threshold ? 2 : 0) |
                  (sw >= threshold ? 1 : 0);

                const segments = EDGE_TABLE[caseIdx];
                if (!segments.length) continue;

                for (const [e1, e2] of segments) {
                  const a = edgePoint(e1, i, j, nw, ne, se, sw, threshold);
                  const b = edgePoint(e2, i, j, nw, ne, se, sw, threshold);
                  p.line(a[0], a[1], b[0], b[1]);
                }
              }
            }
          }
        };
      };

      let instance: any;
      try {
        instance = new p5Constructor(sketch);
      } catch (err) {
        console.error("[FlowBackground] p5 sketch error:", err);
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
          const newInstance = new p5Constructor(sketch);
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
  }, []);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
