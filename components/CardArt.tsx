"use client";

import { useEffect, useRef, useState } from "react";

const PALETTE = ["#2c695a", "#7c843d", "#AD7049", "#8B9A7B", "#648675", "#C4B39A", "#9a6b4a"];

interface CardArtProps {
  seed: string;
  width?: number;
  height?: number;
  onReady?: () => void;
}

// Simple seeded PRNG (mulberry32)
function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Simple 2D noise approximation using seeded random grid
function createNoise(rng: () => number) {
  const size = 64;
  const grid: number[] = [];
  for (let i = 0; i < size * size; i++) grid.push(rng());

  return (x: number, y: number): number => {
    const xi = ((x % size) + size) % size;
    const yi = ((y % size) + size) % size;
    const x0 = Math.floor(xi);
    const y0 = Math.floor(yi);
    const x1 = (x0 + 1) % size;
    const y1 = (y0 + 1) % size;
    const fx = xi - x0;
    const fy = yi - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = grid[y0 * size + x0];
    const n10 = grid[y0 * size + x1];
    const n01 = grid[y1 * size + x0];
    const n11 = grid[y1 * size + x1];
    return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function CardArt({ seed, width = 240, height = 360, onReady }: CardArtProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use devicePixelRatio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const rng = createRng(hashStr(seed));
    const noise = createNoise(rng);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
    const range = (min: number, max: number) => min + rng() * (max - min);

    // Background
    ctx.fillStyle = "#ebe7de";
    ctx.fillRect(0, 0, width, height);

    // Layer 1: Large soft watercolor blobs
    for (let i = 0; i < 12; i++) {
      const [r, g, b] = hexToRgb(pick(PALETTE));
      const alpha = range(0.06, 0.18);
      const cx = range(width * 0.05, width * 0.95);
      const cy = range(height * 0.05, height * 0.75);
      const radius = range(width * 0.15, width * 0.45);

      // Draw multiple overlapping circles for watercolor texture
      for (let j = 0; j < 5; j++) {
        const ox = range(-radius * 0.15, radius * 0.15);
        const oy = range(-radius * 0.15, radius * 0.15);
        const r2 = radius * range(0.7, 1.1);
        const grad = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r2);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        grad.addColorStop(0.6, `rgba(${r},${g},${b},${alpha * 0.6})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, r2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Layer 2: Flow lines through noise field
    const noiseScale = 0.12;
    const segLen = 2;

    for (let i = 0; i < 80; i++) {
      let cx = range(0, width);
      let cy = range(0, height * 0.85);
      const [r, g, b] = hexToRgb(pick(PALETTE));
      const alpha = range(0.1, 0.4);
      const lineWidth = range(0.3, 1.5);

      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy);

      for (let s = 0; s < 50; s++) {
        const n = noise(cx * noiseScale, cy * noiseScale);
        const angle = n * Math.PI * 2;
        cx += segLen * Math.cos(angle);
        cy += segLen * Math.sin(angle);
        if (cx < -5 || cx > width + 5 || cy < -5 || cy > height + 5) break;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // Layer 3: Bold accent strokes
    for (let i = 0; i < 10; i++) {
      let cx = range(width * 0.1, width * 0.9);
      let cy = range(height * 0.1, height * 0.7);
      const [r, g, b] = hexToRgb(pick(PALETTE));
      const alpha = range(0.25, 0.55);
      const lineWidth = range(2, 4);

      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy);

      for (let s = 0; s < 70; s++) {
        const n = noise(cx * noiseScale * 0.8, cy * noiseScale * 0.8);
        const angle = n * Math.PI * 2;
        cx += 3 * Math.cos(angle);
        cy += 3 * Math.sin(angle);
        if (cx < -5 || cx > width + 5 || cy < -5 || cy > height + 5) break;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // Layer 4: Tiny dot texture
    for (let i = 0; i < 200; i++) {
      const [r, g, b] = hexToRgb(pick(PALETTE));
      ctx.fillStyle = `rgba(${r},${g},${b},${range(0.03, 0.12)})`;
      ctx.beginPath();
      ctx.arc(range(0, width), range(0, height * 0.8), range(0.5, 2), 0, Math.PI * 2);
      ctx.fill();
    }

    setRendered(true);
    onReady?.();
  }, [seed, width, height, onReady]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={`absolute inset-0 ${rendered ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
      aria-hidden="true"
    />
  );
}
