import { BANDS, RAINBOW, ROAD_HALF } from './constants';
import { drawBoxX, drawTris } from './gl';
import { rgb } from './math';
import { frameAt, sampleEvery, troughY, type Frame } from './path';

const bands: number[][] = [];
const post = {
  s: 0,
  x: 0,
  y: 0,
  z: 0,
  tx: 0,
  ty: 0,
  tz: 0,
  nx: 0,
  ny: 0,
  nz: 0,
  ux: 0,
  uy: 0,
  uz: 0,
};

function rim(fr: Frame, x: number, out: number[]): void {
  const h = troughY(x);
  out[0] = fr.x + fr.nx * x + fr.ux * h;
  out[1] = fr.y + fr.ny * x + fr.uy * h;
  out[2] = fr.z + fr.nz * x + fr.uz * h;
}

function buildRoad(): void {
  const samples = sampleEvery(1.05);
  samples.push(samples[0]);
  for (let b = 0; b < BANDS; b++) {
    bands[b] = [];
  }
  const a = [0, 0, 0];
  const c = [0, 0, 0];
  const d = [0, 0, 0];
  const e = [0, 0, 0];
  for (let i = 0; i < samples.length - 1; i++) {
    const f0 = samples[i];
    const f1 = samples[i + 1];
    for (let b = 0; b < BANDS; b++) {
      const x0 = -ROAD_HALF + (ROAD_HALF * 2 * b) / BANDS;
      const x1 = -ROAD_HALF + (ROAD_HALF * 2 * (b + 1)) / BANDS;
      rim(f0, x0, a);
      rim(f0, x1, c);
      rim(f1, x1, d);
      rim(f1, x0, e);
      const dest = bands[b];
      dest.push(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
      dest.push(a[0], a[1], a[2], d[0], d[1], d[2], e[0], e[1], e[2]);
    }
  }
}

buildRoad();

export function drawRoad(view: Float32Array): void {
  for (let b = 0; b < BANDS; b++) {
    const col = rgb(RAINBOW[b]);
    drawTris(view, bands[b], col[0], col[1], col[2]);
  }
  frameAt(0, post);
  const hx = ROAD_HALF * 0.92;
  const h = troughY(hx) + 1.6;
  drawBoxX(
    view,
    post.x + post.nx * hx + post.ux * h,
    post.y + post.ny * hx + post.uy * h,
    post.z + post.nz * hx + post.uz * h,
    post.nx,
    post.ny,
    post.nz,
    post.ux,
    post.uy,
    post.uz,
    post.tx,
    post.ty,
    post.tz,
    0.18,
    3.2,
    0.18,
    0.95,
    0.95,
    0.95
  );
  drawBoxX(
    view,
    post.x - post.nx * hx + post.ux * h,
    post.y - post.ny * hx + post.uy * h,
    post.z - post.nz * hx + post.uz * h,
    post.nx,
    post.ny,
    post.nz,
    post.ux,
    post.uy,
    post.uz,
    post.tx,
    post.ty,
    post.tz,
    0.18,
    3.2,
    0.18,
    0.95,
    0.95,
    0.95
  );
}
