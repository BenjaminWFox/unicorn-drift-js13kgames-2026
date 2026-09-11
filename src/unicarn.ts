import { GHOST_ALPHA } from './constants';
import { drawBoxX, drawPyrX, setDepthWrite, setDrawAlpha } from './gl';

const BODY = [0.93, 0.94, 0.98];
const SHADOW = [0.78, 0.8, 0.88];
const HORN = [0.95, 0.82, 0.4];
const TIRE = [0.18, 0.18, 0.22];
const HUB = [0.72, 0.74, 0.8];
const MANE = [0.72, 0.76, 0.92];
const EYE = [0.12, 0.12, 0.16];
const EAR = [0.95, 0.72, 0.78];

const wp = [0, 0, 0];

function put(
  px: number,
  py: number,
  pz: number,
  rx: number,
  ry: number,
  rz: number,
  ux: number,
  uy: number,
  uz: number,
  fx: number,
  fy: number,
  fz: number,
  lx: number,
  ly: number,
  lz: number
): void {
  wp[0] = px + rx * lx + ux * ly + fx * lz;
  wp[1] = py + ry * lx + uy * ly + fy * lz;
  wp[2] = pz + rz * lx + uz * ly + fz * lz;
}

export function drawUnicarn(
  view: Float32Array,
  px: number,
  py: number,
  pz: number,
  rx: number,
  ry: number,
  rz: number,
  ux: number,
  uy: number,
  uz: number,
  fx: number,
  fy: number,
  fz: number,
  wheel: number,
  slide: number,
  ghost: boolean
): void {
  const lean = Math.max(-0.38, Math.min(0.38, slide * 0.36));
  const lc = Math.cos(lean);
  const ls = Math.sin(lean);
  const crx = rx * lc + ux * ls;
  const cry = ry * lc + uy * ls;
  const crz = rz * lc + uz * ls;
  const cux = ux * lc - rx * ls;
  const cuy = uy * lc - ry * ls;
  const cuz = uz * lc - rz * ls;
  if (ghost) {
    setDrawAlpha(GHOST_ALPHA);
  }

  const box = (
    lx: number,
    ly: number,
    lz: number,
    sx: number,
    sy: number,
    sz: number,
    r: number,
    g: number,
    b: number
  ): void => {
    put(px, py, pz, crx, cry, crz, cux, cuy, cuz, fx, fy, fz, lx, ly, lz);
    drawBoxX(view, wp[0], wp[1], wp[2], crx, cry, crz, cux, cuy, cuz, fx, fy, fz, sx, sy, sz, r, g, b);
  };

  box(0, 0.62, 0.08, 0.82, 0.48, 1.42, BODY[0], BODY[1], BODY[2]);
  box(0, 0.5, 0.08, 0.64, 0.26, 1.1, SHADOW[0], SHADOW[1], SHADOW[2]);
  box(0, 0.88, 0.78, 0.3, 0.28, 0.44, BODY[0], BODY[1], BODY[2]);
  box(0, 0.98, 1.2, 0.38, 0.3, 0.72, BODY[0], BODY[1], BODY[2]);
  put(px, py, pz, crx, cry, crz, cux, cuy, cuz, fx, fy, fz, 0, 1.32, 1.32);
  drawPyrX(view, wp[0], wp[1], wp[2], crx, cry, crz, cux, cuy, cuz, fx, fy, fz, 0.12, 0.5, 0.12, HORN[0], HORN[1], HORN[2]);
  box(-0.12, 1.02, 1.42, 0.07, 0.08, 0.07, EYE[0], EYE[1], EYE[2]);
  box(0.12, 1.02, 1.42, 0.07, 0.08, 0.07, EYE[0], EYE[1], EYE[2]);
  box(-0.2, 1.16, 1.1, 0.1, 0.16, 0.08, BODY[0], BODY[1], BODY[2]);
  box(0.2, 1.16, 1.1, 0.1, 0.16, 0.08, BODY[0], BODY[1], BODY[2]);
  box(-0.2, 1.14, 1.12, 0.05, 0.08, 0.04, EAR[0], EAR[1], EAR[2]);
  box(0.2, 1.14, 1.12, 0.05, 0.08, 0.04, EAR[0], EAR[1], EAR[2]);
  box(0, 1.08, 0.58, 0.08, 0.22, 0.5, MANE[0], MANE[1], MANE[2]);
  box(0, 1.0, 0.9, 0.07, 0.18, 0.34, MANE[0], MANE[1], MANE[2]);
  box(0, 0.72, -0.92, 0.1, 0.12, 0.55, MANE[0], MANE[1], MANE[2]);
  box(0, 0.58, -1.22, 0.08, 0.08, 0.4, MANE[0], MANE[1], MANE[2]);

  const spin = Math.sin(wheel) * 0.08;
  const c = Math.cos(wheel);
  const sn = Math.sin(wheel);
  const wrx = crx * c + cux * sn;
  const wry = cry * c + cuy * sn;
  const wrz = crz * c + cuz * sn;
  const wux = -crx * sn + cux * c;
  const wuy = -cry * sn + cuy * c;
  const wuz = -crz * sn + cuz * c;
  const tires = [
    [-0.5, 0.22, 0.52],
    [0.5, 0.22, 0.52],
    [-0.5, 0.22, -0.52],
    [0.5, 0.22, -0.52],
  ];
  for (const t of tires) {
    put(px, py, pz, crx, cry, crz, cux, cuy, cuz, fx, fy, fz, t[0], t[1] + spin * 0.02, t[2]);
    drawBoxX(view, wp[0], wp[1], wp[2], wrx, wry, wrz, wux, wuy, wuz, fx, fy, fz, 0.22, 0.42, 0.42, TIRE[0], TIRE[1], TIRE[2]);
    drawBoxX(view, wp[0], wp[1], wp[2], wrx, wry, wrz, wux, wuy, wuz, fx, fy, fz, 0.1, 0.18, 0.18, HUB[0], HUB[1], HUB[2]);
  }

  setDepthWrite(false);
  const prev = setDrawAlpha(ghost ? GHOST_ALPHA * 0.45 : 0.35);
  put(px, py, pz, crx, cry, crz, cux, cuy, cuz, fx, fy, fz, 0, 0.02, 0);
  drawBoxX(
    view,
    wp[0] + cux * 0.02,
    wp[1] + cuy * 0.02,
    wp[2] + cuz * 0.02,
    crx,
    cry,
    crz,
    cux,
    cuy,
    cuz,
    fx,
    fy,
    fz,
    0.9,
    0.04,
    1.5,
    0.05,
    0.03,
    0.08
  );
  setDrawAlpha(prev);
  setDepthWrite(true);
  if (ghost) {
    setDrawAlpha(1);
  }
}
