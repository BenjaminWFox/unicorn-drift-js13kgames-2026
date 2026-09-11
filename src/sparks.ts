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
};

const sparks: Spark[] = [];
const MAX = 70;

export function clearSparks(): void {
  sparks.length = 0;
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
    if (sparks.length >= MAX) {
      sparks.shift();
    }
    const side = (Math.random() - 0.5) * 2.2;
    sparks.push({
      x: x - fwd[0] * 1.25 + right[0] * side,
      y: y - fwd[1] * 1.25 + up[1] * 0.12,
      z: z - fwd[2] * 1.25 + right[2] * side,
      vx: -fwd[0] * (6 + Math.random() * 8) + right[0] * (Math.random() - 0.5) * 8,
      vy: up[1] * (1 + Math.random() * 5) + Math.random() * 2,
      vz: -fwd[2] * (6 + Math.random() * 8) + right[2] * (Math.random() - 0.5) * 8,
      life: 0.34 + Math.random() * 0.32,
      c: (Math.random() * 7) | 0,
    });
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
    p.vy -= 18 * dt;
  }
}

export function drawSparks(view: Float32Array): void {
  if (!sparks.length) {
    return;
  }
  setDepthWrite(false);
  for (const p of sparks) {
    const col = rgb(RAINBOW[p.c]);
    setDrawAlpha(Math.max(0, p.life * 3));
    const sc = 0.12 + p.life * 0.2;
    drawOct(view, p.x, p.y, p.z, 0, 0, sc, sc, sc, col[0], col[1], col[2]);
  }
  setDrawAlpha(1);
  setDepthWrite(true);
}
