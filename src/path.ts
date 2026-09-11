import { CONCAVE, ROAD_HALF } from './constants';

export type Frame = {
  s: number;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  nx: number;
  ny: number;
  nz: number;
  ux: number;
  uy: number;
  uz: number;
};

const frames: Frame[] = [];
export let trackLen = 1;

const STEP = 0.55;

const P = [0, 0, 0];
const T = [0, 0, 1];
const U = [0, 1, 0];
let dist = 0;

function norm(v: number[]): void {
  const i = 1 / Math.hypot(v[0], v[1], v[2]);
  v[0] *= i;
  v[1] *= i;
  v[2] *= i;
}

function cross(a: number[], b: number[], out: number[]): void {
  out[0] = a[1] * b[2] - a[2] * b[1];
  out[1] = a[2] * b[0] - a[0] * b[2];
  out[2] = a[0] * b[1] - a[1] * b[0];
}

function rodrigues(v: number[], ax: number[], ang: number): void {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const d = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2];
  const cx = ax[1] * v[2] - ax[2] * v[1];
  const cy = ax[2] * v[0] - ax[0] * v[2];
  const cz = ax[0] * v[1] - ax[1] * v[0];
  v[0] = v[0] * c + cx * s + ax[0] * d * (1 - c);
  v[1] = v[1] * c + cy * s + ax[1] * d * (1 - c);
  v[2] = v[2] * c + cz * s + ax[2] * d * (1 - c);
}

function orthonormal(): { nx: number; ny: number; nz: number } {
  norm(T);
  const N = [0, 0, 0];
  cross(U, T, N);
  if (Math.hypot(N[0], N[1], N[2]) < 1e-5) {
    N[0] = 1;
  }
  norm(N);
  cross(T, N, U);
  norm(U);
  return { nx: N[0], ny: N[1], nz: N[2] };
}

function push(): void {
  const n = orthonormal();
  frames.push({
    s: dist,
    x: P[0],
    y: P[1],
    z: P[2],
    tx: T[0],
    ty: T[1],
    tz: T[2],
    nx: n.nx,
    ny: n.ny,
    nz: n.nz,
    ux: U[0],
    uy: U[1],
    uz: U[2],
  });
}

function advance(len: number, ds: number): void {
  const steps = Math.max(2, Math.round(len / ds));
  const step = len / steps;
  for (let i = 0; i < steps; i++) {
    P[0] += T[0] * step;
    P[1] += T[1] * step;
    P[2] += T[2] * step;
    dist += step;
    push();
  }
}

function bump(height: number, len: number): void {
  const steps = Math.max(8, Math.round(len / (STEP * 0.65)));
  const ds = len / steps;
  const T0 = [T[0], T[1], T[2]];
  const U0 = [U[0], U[1], U[2]];
  const P0 = [P[0], P[1], P[2]];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const o = 1 - t;
    // C2 at the flats so the pitch does not kick at the lip.
    const y = height * 64 * t * t * t * o * o * o;
    const dyds = (height * 192 * t * t * o * o * (1 - 2 * t)) / len;
    const pitch = Math.atan(dyds);
    P[0] = P0[0] + T0[0] * (ds * i);
    P[1] = P0[1] + T0[1] * (ds * i) + y;
    P[2] = P0[2] + T0[2] * (ds * i);
    T[0] = T0[0];
    T[1] = T0[1];
    T[2] = T0[2];
    U[0] = U0[0];
    U[1] = U0[1];
    U[2] = U0[2];
    const N = [0, 0, 0];
    cross(U0, T0, N);
    norm(N);
    rodrigues(T, N, pitch);
    rodrigues(U, N, pitch);
    dist += ds;
    push();
  }
}

function scurve(radius: number, sweep: number, mid: number): void {
  yawArc(radius, sweep);
  advance(mid, STEP);
  yawArc(radius, -sweep);
}

function yawArc(radius: number, sweep: number): void {
  const sign = sweep > 0 ? 1 : -1;
  const R = Math.abs(radius);
  const len = R * Math.abs(sweep);
  const steps = Math.max(6, Math.round(len / (STEP * 0.7)));
  const ds = len / steps;
  const dAng = (sign * ds) / R;
  for (let i = 0; i < steps; i++) {
    P[0] += T[0] * ds;
    P[1] += T[1] * ds;
    P[2] += T[2] * ds;
    rodrigues(T, U, dAng);
    dist += ds;
    push();
  }
}

function loop(R: number, F: number, lane: number): void {
  const T0 = [T[0], T[1], T[2]];
  const U0 = [U[0], U[1], U[2]];
  const N0 = [0, 0, 0];
  cross(U0, T0, N0);
  norm(N0);
  const P0 = [P[0], P[1], P[2]];
  const steps = Math.max(64, Math.round(((R + Math.abs(F)) * Math.PI * 2) / STEP));
  const N = [0, 0, 0];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const th = t * Math.PI * 2;
    const cy = R * (1 - Math.cos(th));
    const cz = R * Math.sin(th) + F * th;
    // Smooth lane change: ends parallel to the approach (zero dN at 0 and 2π).
    const cn = lane * t * t * (3 - 2 * t);
    const dcn = (lane * 6 * t * (1 - t)) / (Math.PI * 2);
    P[0] = P0[0] + U0[0] * cy + T0[0] * cz + N0[0] * cn;
    P[1] = P0[1] + U0[1] * cy + T0[1] * cz + N0[1] * cn;
    P[2] = P0[2] + U0[2] * cy + T0[2] * cz + N0[2] * cn;
    const dcy = R * Math.sin(th);
    const dcz = R * Math.cos(th) + F;
    T[0] = U0[0] * dcy + T0[0] * dcz + N0[0] * dcn;
    T[1] = U0[1] * dcy + T0[1] * dcz + N0[1] * dcn;
    T[2] = U0[2] * dcy + T0[2] * dcz + N0[2] * dcn;
    norm(T);
    U[0] = U0[0];
    U[1] = U0[1];
    U[2] = U0[2];
    rodrigues(U, N0, -th);
    N[0] = N0[0];
    N[1] = N0[1];
    N[2] = N0[2];
    const nd = T[0] * N[0] + T[1] * N[1] + T[2] * N[2];
    N[0] -= T[0] * nd;
    N[1] -= T[1] * nd;
    N[2] -= T[2] * nd;
    if (N[0] * N0[0] + N[1] * N0[1] + N[2] * N0[2] < 0) {
      N[0] = -N[0];
      N[1] = -N[1];
      N[2] = -N[2];
    }
    norm(N);
    const ud = T[0] * U[0] + T[1] * U[1] + T[2] * U[2];
    U[0] -= T[0] * ud;
    U[1] -= T[1] * ud;
    U[2] -= T[2] * ud;
    const un = N[0] * U[0] + N[1] * U[1] + N[2] * U[2];
    U[0] -= N[0] * un;
    U[1] -= N[1] * un;
    U[2] -= N[2] * un;
    norm(U);
    const last = frames[frames.length - 1];
    dist += Math.hypot(P[0] - last.x, P[1] - last.y, P[2] - last.z) || STEP;
    frames.push({
      s: dist,
      x: P[0],
      y: P[1],
      z: P[2],
      tx: T[0],
      ty: T[1],
      tz: T[2],
      nx: N[0],
      ny: N[1],
      nz: N[2],
      ux: U[0],
      uy: U[1],
      uz: U[2],
    });
  }
  // Parallel transport around a shifted loop banks the exit. Snap back so
  // the oval stays in XZ; position is already on the exit lane.
  T[0] = T0[0];
  T[1] = T0[1];
  T[2] = T0[2];
  U[0] = U0[0];
  U[1] = U0[1];
  U[2] = U0[2];
  P[1] = P0[1];
}

function build(): void {
  frames.length = 0;
  P[0] = 0;
  P[1] = 0;
  P[2] = 0;
  T[0] = 0;
  T[1] = 0;
  T[2] = 1;
  U[0] = 0;
  U[1] = 1;
  U[2] = 0;
  dist = 0;
  push();

  const LEFT = Math.PI * 0.5;
  const RIGHT = -Math.PI * 0.5;
  const LANE = -15;
  const C1 = 64;
  const C2 = 46;
  const SHORT = 30;
  const TAIL = 22;
  const LOOP_F = 2.8;
  const LOOP2_F = 2.2;
  const pre1 = 26 + 32 + 6 + LOOP_F * Math.PI * 2 + 12;
  const pre2 = 18 + 30 + 8 + LOOP2_F * Math.PI * 2 + 10;

  advance(26, STEP);
  bump(6.5, 32);
  advance(6, STEP);
  loop(13.5, LOOP_F, LANE);
  advance(12, STEP);
  scurve(36, 1.05, 8);
  bump(3.6, 18);
  advance(TAIL - 18, STEP);
  yawArc(C1, LEFT);

  advance(8, STEP);
  yawArc(30, RIGHT);
  advance(12, STEP);
  yawArc(30, LEFT);
  bump(3.2, 20);
  advance(SHORT - 20, STEP);
  yawArc(C2, LEFT);

  advance(18, STEP);
  bump(-5.5, 30);
  advance(8, STEP);
  loop(10.5, LOOP2_F, LANE);
  advance(10, STEP);
  scurve(36, 1.05, 8);
  bump(3.8, 18);
  advance(TAIL + pre1 - pre2 - 18, STEP);
  yawArc(C1, LEFT);

  advance(8, STEP);
  yawArc(30, RIGHT);
  advance(12, STEP);
  yawArc(30, LEFT);
  bump(-2.8, 20);
  advance(SHORT - 20, STEP);
  yawArc(C2, LEFT);
  closeToStart();

  trackLen = dist;
}

function closeToStart(): void {
  const start = frames[0];
  const end = frames[frames.length - 1];
  const gap = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
  if (gap < 0.35) {
    return;
  }
  const steps = Math.max(4, Math.round(gap / STEP));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    P[0] = end.x + (start.x - end.x) * t;
    P[1] = end.y + (start.y - end.y) * t;
    P[2] = end.z + (start.z - end.z) * t;
    T[0] = end.tx + (start.tx - end.tx) * t;
    T[1] = end.ty + (start.ty - end.ty) * t;
    T[2] = end.tz + (start.tz - end.tz) * t;
    U[0] = end.ux + (start.ux - end.ux) * t;
    U[1] = end.uy + (start.uy - end.uy) * t;
    U[2] = end.uz + (start.uz - end.uz) * t;
    dist += gap / steps;
    push();
  }
}

build();

function wrapS(s: number): number {
  const L = trackLen;
  return ((s % L) + L) % L;
}

function find(s: number): number {
  s = wrapS(s);
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].s < s) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function nlerp(ax: number, ay: number, az: number, bx: number, by: number, bz: number, t: number, out: number[]): void {
  out[0] = ax + (bx - ax) * t;
  out[1] = ay + (by - ay) * t;
  out[2] = az + (bz - az) * t;
  norm(out);
}

const tA = [0, 0, 0];
const uA = [0, 0, 0];
const nA = [0, 0, 0];

export function frameAt(s: number, out: Frame): void {
  s = wrapS(s);
  let i = find(s);
  if (i <= 0) {
    copyFrame(frames[0], out);
    return;
  }
  const a = frames[i - 1];
  const b = frames[i] || frames[0];
  const span = b.s - a.s || 1;
  const t = Math.max(0, Math.min(1, (s - a.s) / span));
  out.s = s;
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  nlerp(a.tx, a.ty, a.tz, b.tx, b.ty, b.tz, t, tA);
  nlerp(a.ux, a.uy, a.uz, b.ux, b.uy, b.uz, t, uA);
  nlerp(a.nx, a.ny, a.nz, b.nx, b.ny, b.nz, t, nA);
  const nd = tA[0] * nA[0] + tA[1] * nA[1] + tA[2] * nA[2];
  nA[0] -= tA[0] * nd;
  nA[1] -= tA[1] * nd;
  nA[2] -= tA[2] * nd;
  if (Math.hypot(nA[0], nA[1], nA[2]) < 1e-5) {
    nA[0] = 1;
  }
  norm(nA);
  const ud = tA[0] * uA[0] + tA[1] * uA[1] + tA[2] * uA[2];
  uA[0] -= tA[0] * ud;
  uA[1] -= tA[1] * ud;
  uA[2] -= tA[2] * ud;
  const un = nA[0] * uA[0] + nA[1] * uA[1] + nA[2] * uA[2];
  uA[0] -= nA[0] * un;
  uA[1] -= nA[1] * un;
  uA[2] -= nA[2] * un;
  if (Math.hypot(uA[0], uA[1], uA[2]) < 1e-5) {
    uA[1] = 1;
  }
  norm(uA);
  out.tx = tA[0];
  out.ty = tA[1];
  out.tz = tA[2];
  out.nx = nA[0];
  out.ny = nA[1];
  out.nz = nA[2];
  out.ux = uA[0];
  out.uy = uA[1];
  out.uz = uA[2];
}

function copyFrame(src: Frame, out: Frame): void {
  out.s = src.s;
  out.x = src.x;
  out.y = src.y;
  out.z = src.z;
  out.tx = src.tx;
  out.ty = src.ty;
  out.tz = src.tz;
  out.nx = src.nx;
  out.ny = src.ny;
  out.nz = src.nz;
  out.ux = src.ux;
  out.uy = src.uy;
  out.uz = src.uz;
}

export function troughY(x: number): number {
  const u = x / ROAD_HALF;
  return CONCAVE * u * u;
}

export function surface(
  s: number,
  x: number,
  hop: number,
  out: Frame
): void {
  frameAt(s, out);
  const h = troughY(x) + hop;
  out.x += out.nx * x + out.ux * h;
  out.y += out.ny * x + out.uy * h;
  out.z += out.nz * x + out.uz * h;
}

/** World XZ yaw of the path tangent (0 = +Z). */
export function tangentYaw(fr: Frame): number {
  return Math.atan2(fr.tx, fr.tz);
}

/** Face a compass yaw; do not auto-align to the ribbon tangent. */
export function headingAxes(fr: Frame, yaw: number, F: number[], N: number[], Up: number[]): void {
  const wx = Math.sin(yaw);
  const wz = Math.cos(yaw);
  const along = fr.tx * wx + fr.tz * wz;
  const side = fr.nx * wx + fr.nz * wz;
  F[0] = fr.tx * along + fr.nx * side;
  F[1] = fr.ty * along + fr.ny * side;
  F[2] = fr.tz * along + fr.nz * side;
  if (Math.hypot(F[0], F[1], F[2]) < 1e-4) {
    F[0] = fr.tx;
    F[1] = fr.ty;
    F[2] = fr.tz;
  }
  Up[0] = fr.ux;
  Up[1] = fr.uy;
  Up[2] = fr.uz;
  cross(Up, F, N);
  if (Math.hypot(N[0], N[1], N[2]) < 1e-5) {
    N[0] = 1;
  }
  norm(N);
  cross(F, N, Up);
  norm(F);
  norm(Up);
}

export function gateS(distAlong: number): number {
  const along = wrapS(distAlong);
  const q = trackLen * 0.25;
  let g = 0;
  if (along >= q * 3) {
    g = q * 3;
  } else if (along >= q * 2) {
    g = q * 2;
  } else if (along >= q) {
    g = q;
  }
  return g;
}

export function sampleEvery(step: number): Frame[] {
  const out: Frame[] = [];
  for (let s = 0; s < trackLen; s += step) {
    const f = {
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
    frameAt(s, f);
    out.push(f);
  }
  return out;
}
