import { BANDS, PAD_HALF, PAD_LEN, RAINBOW, ROAD_HALF } from './constants';
import { drawBoxX, drawOct, drawTris, setDepthWrite, setDrawAlpha } from './gl';
import { rgb } from './math';
import { frameAt, pads, sampleEvery, troughY, wrapS, type Frame } from './path';

const bands: number[][] = [];
const padMesh: number[] = [];
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
const padFr: Frame = {
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

function rim(fr: Frame, x: number, lift: number, out: number[]): void {
  const h = troughY(x) + lift;
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
      rim(f0, x0, 0, a);
      rim(f0, x1, 0, c);
      rim(f1, x1, 0, d);
      rim(f1, x0, 0, e);
      const dest = bands[b];
      dest.push(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
      dest.push(a[0], a[1], a[2], d[0], d[1], d[2], e[0], e[1], e[2]);
    }
  }
  for (let i = 0; i < pads.length; i += 2) {
    const s0 = pads[i];
    const xc = pads[i + 1];
    const x0 = xc - PAD_HALF;
    const x1 = xc + PAD_HALF;
    const n = 6;
    for (let k = 0; k < n; k++) {
      frameAt(s0 + (PAD_LEN * k) / n, post);
      frameAt(s0 + (PAD_LEN * (k + 1)) / n, padFr);
      rim(post, x0, 0.08, a);
      rim(post, x1, 0.08, c);
      rim(padFr, x1, 0.08, d);
      rim(padFr, x0, 0.08, e);
      padMesh.push(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
      padMesh.push(a[0], a[1], a[2], d[0], d[1], d[2], e[0], e[1], e[2]);
    }
  }
}

buildRoad();

export function onBoostPad(ps: number, px: number, ang: number): boolean {
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  for (let i = 0; i < pads.length; i += 2) {
    const s0 = pads[i];
    const xc = pads[i + 1];
    for (let k = 0; k < 5; k++) {
      const lx = k ? (k & 1 ? 0.35 : -0.35) : 0;
      const lz = k ? (k < 3 ? 0.9 : -1.2) : 0;
      if (
        wrapS(ps + lz * c - lx * sn - s0) < PAD_LEN + 0.7 &&
        Math.abs(px + lx * c + lz * sn - xc) < PAD_HALF + 0.12
      ) {
        return true;
      }
    }
  }
  return false;
}

export function drawRoad(view: Float32Array): void {
  for (let b = 0; b < BANDS; b++) {
    const col = rgb(RAINBOW[b]);
    drawTris(view, bands[b], col[0], col[1], col[2]);
  }
  drawTris(view, padMesh, 1, 0.86, 0.18);
  setDepthWrite(false);
  const t = performance.now() * 0.001;
  for (let i = 0; i < pads.length; i += 2) {
    const s0 = pads[i];
    const xc = pads[i + 1];
    for (let n = 0; n < 14; n++) {
      const u = (n * 0.071 + t * 0.28) % 1;
      frameAt(s0 + 1 + u * (PAD_LEN - 2), post);
      const side = xc + Math.sin(t * 2.3 + n * 1.9) * PAD_HALF * 0.72;
      const h = troughY(side) + 0.45 + u * 6.4;
      const sc = 0.12 + (1 - u) * 0.22;
      setDrawAlpha(0.22 + (1 - u) * 0.7);
      drawOct(
        view,
        post.x + post.nx * side + post.ux * h,
        post.y + post.ny * side + post.uy * h,
        post.z + post.nz * side + post.uz * h,
        t * 0.7 + n,
        t * 1.1 + n * 0.4,
        sc,
        sc,
        sc,
        1,
        0.84 + u * 0.12,
        0.18
      );
    }
  }
  setDrawAlpha(1);
  setDepthWrite(true);
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
