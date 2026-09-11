import { GHOST_HZ, ROAD_HALF } from './constants';
import { trackLen } from './path';

export type Sample = { t: number; s: number; x: number; h: number };

const TIME_SPAN = 240;
const X_SPAN = ROAD_HALF * 1.3;
const TAU = Math.PI * 2;

let rec: Sample[] = [];
let acc = 0;
let clock = 0;
let play: Sample[] = [];

export function resetRecord(): void {
  rec = [];
  acc = 0;
  clock = 0;
}

export function ghostClock(): number {
  return clock;
}

export function recordTick(dt: number, s: number, x: number, heading: number): void {
  clock += dt;
  acc += dt;
  if (acc < 1 / GHOST_HZ && rec.length) {
    return;
  }
  acc = 0;
  rec.push({ t: clock, s, x, h: heading });
}

export function recorded(): Sample[] {
  return rec;
}

function wrapH(h: number): number {
  return ((h + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

export function packGhost(samples: Sample[]): string {
  const n = samples.length;
  const buf = new Uint8Array(n * 6);
  const span = trackLen || 1;
  for (let i = 0; i < n; i++) {
    const t16 = Math.max(0, Math.min(65535, ((samples[i].t / TIME_SPAN) * 65535) | 0));
    const s16 = Math.max(0, Math.min(65535, ((samples[i].s / span) * 65535) | 0));
    const o = i * 6;
    buf[o] = t16 >> 8;
    buf[o + 1] = t16 & 255;
    buf[o + 2] = s16 >> 8;
    buf[o + 3] = s16 & 255;
    buf[o + 4] = Math.max(0, Math.min(255, ((samples[i].x / X_SPAN) * 127 + 128) | 0));
    buf[o + 5] = Math.max(0, Math.min(255, ((wrapH(samples[i].h) / Math.PI + 1) * 0.5 * 255) | 0));
  }
  let raw = '';
  for (let i = 0; i < buf.length; i++) {
    raw += String.fromCharCode(buf[i]);
  }
  return btoa(raw);
}

export function unpackGhost(data: string): Sample[] {
  try {
    const raw = atob(data);
    const out: Sample[] = [];
    if (raw.length % 6 === 0) {
      const span = trackLen || 1;
      for (let i = 0; i + 5 < raw.length; i += 6) {
        const t16 = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
        const s16 = (raw.charCodeAt(i + 2) << 8) | raw.charCodeAt(i + 3);
        out.push({
          t: (t16 / 65535) * TIME_SPAN,
          s: (s16 / 65535) * span,
          x: ((raw.charCodeAt(i + 4) - 128) / 127) * X_SPAN,
          h: (raw.charCodeAt(i + 5) / 255) * 2 * Math.PI - Math.PI,
        });
      }
      return out;
    }
    const span = trackLen * 2.2 || 1;
    for (let i = 0; i + 3 < raw.length; i += 4) {
      const s16 = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
      out.push({
        t: out.length / GHOST_HZ,
        s: (s16 / 65535) * span,
        x: ((raw.charCodeAt(i + 2) - 128) / 127) * 5.2,
        h: (raw.charCodeAt(i + 3) / 255) * 2 * Math.PI - Math.PI,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function setPlayback(samples: Sample[]): void {
  play = samples;
}

export function hasGhost(): boolean {
  return play.length > 1;
}

export function ghostAt(time: number, out: Sample): boolean {
  if (play.length < 2) {
    return false;
  }
  if (time <= play[0].t) {
    out.t = play[0].t;
    out.s = play[0].s;
    out.x = play[0].x;
    out.h = play[0].h;
    return true;
  }
  const last = play[play.length - 1];
  if (time >= last.t) {
    out.t = last.t;
    out.s = last.s;
    out.x = last.x;
    out.h = last.h;
    return true;
  }
  let lo = 0;
  let hi = play.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (play[mid].t < time) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const b = play[lo];
  const a = play[lo - 1] || b;
  const span = b.t - a.t || 1;
  const u = (time - a.t) / span;
  let ds = b.s - a.s;
  const half = trackLen * 0.5;
  if (ds > half) {
    ds -= trackLen;
  } else if (ds < -half) {
    ds += trackLen;
  }
  out.t = time;
  out.s = a.s + ds * u;
  out.x = a.x + (b.x - a.x) * u;
  out.h = a.h + (b.h - a.h) * u;
  return true;
}
