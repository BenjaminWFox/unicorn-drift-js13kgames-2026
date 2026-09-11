import { RAINBOW } from './constants';
import { drawOct, setDepthWrite, setDrawAlpha } from './gl';
import { rgb } from './math';

type Spark = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  c: number;
  k: number;
};

const sparks: Spark[] = [];
const MAX = 90;

export function clearSparks(): void {
  sparks.length = 0;
}

function add(
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  life: number,
  c: number,
  k: number
): void {
  if (sparks.length >= MAX) {
    sparks.shift();
  }
  sparks.push({ x, y, z, vx, vy, vz, life, c, k });
}

export function burstSparks(
  x: number,
  y: number,
  z: number,
  fwd: number[],
  up: number[],
  right: number[]
): void {
  for (let i = 0; i < 7; i++) {
    const side = (Math.random() - 0.5) * 2.2;
    add(
      x - fwd[0] * 1.25 + right[0] * side,
      y - fwd[1] * 1.25 + up[1] * 0.12,
      z - fwd[2] * 1.25 + right[2] * side,
      -fwd[0] * (6 + Math.random() * 8) + right[0] * (Math.random() - 0.5) * 8,
      up[1] * (1 + Math.random() * 5) + Math.random() * 2,
      -fwd[2] * (6 + Math.random() * 8) + right[2] * (Math.random() - 0.5) * 8,
      0.34 + Math.random() * 0.32,
      (Math.random() * 7) | 0,
      0
    );
  }
}

export function emitFlames(
  x: number,
  y: number,
  z: number,
  fwd: number[],
  up: number[],
  right: number[],
  n: number
): void {
  for (let i = 0; i < n; i++) {
    const side = (Math.random() - 0.5) * 0.7;
    const back = 1.1 + Math.random() * 0.6;
    add(
      x - fwd[0] * back + right[0] * side + up[0] * 0.15,
      y - fwd[1] * back + right[1] * side + up[1] * 0.15,
      z - fwd[2] * back + right[2] * side + up[2] * 0.15,
      -fwd[0] * (10 + Math.random() * 14) + right[0] * (Math.random() - 0.5) * 2.4,
      -fwd[1] * (10 + Math.random() * 14) + up[1] * (4 + Math.random() * 7),
      -fwd[2] * (10 + Math.random() * 14) + right[2] * (Math.random() - 0.5) * 2.4,
      0.16 + Math.random() * 0.18,
      (Math.random() * 3) | 0,
      1
    );
  }
}

export function updateSparks(dt: number): void {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.life -= dt;
    if (p.life <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    if (p.k) {
      p.vx *= 1 - 2.4 * dt;
      p.vz *= 1 - 2.4 * dt;
      p.vy += 22 * dt;
    } else {
      p.vy -= 18 * dt;
    }
  }
}

const FLAME = [
  [1, 0.95, 0.35],
  [1, 0.58, 0.08],
  [1, 0.28, 0.04],
];

export function drawSparks(view: Float32Array): void {
  if (!sparks.length) {
    return;
  }
  setDepthWrite(false);
  for (const p of sparks) {
    if (p.k) {
      const col = FLAME[p.c];
      setDrawAlpha(Math.min(1, p.life * 5.5));
      const h = 0.28 + p.life * 1.1;
      drawOct(view, p.x, p.y, p.z, 0, 0, 0.07 + p.life * 0.06, h, 0.07 + p.life * 0.06, col[0], col[1], col[2]);
    } else {
      const col = rgb(RAINBOW[p.c]);
      setDrawAlpha(Math.max(0, p.life * 3));
      const sc = 0.12 + p.life * 0.2;
      drawOct(view, p.x, p.y, p.z, 0, 0, sc, sc, sc, col[0], col[1], col[2]);
    }
  }
  setDrawAlpha(1);
  setDepthWrite(true);
}
