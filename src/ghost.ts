import { GHOST_HZ, ROAD_HALF } from './constants';
import { trackLen } from './path';

export type Sample = { t: number; s: number; x: number; h: number; p: number };

const TIME_SPAN = 240;
const X_SPAN = ROAD_HALF * 1.3;
const TAU = Math.PI * 2;
const LOCAL_HZ = 30;

let rec: Sample[] = [];
let clock = 0;
let play: Sample[] = [];

export function resetRecord(): void {
  rec = [];
  clock = 0;
}

export function ghostClock(): number {
  return clock;
}

export function recordTick(dt: number, s: number, x: number, heading: number, hop: number): void {
  clock += dt;
  rec.push({ t: clock, s, x, h: heading, p: hop });
}

export function recorded(): Sample[] {
  return rec;
}

function wrapH(h: number): number {
  return ((h + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

function sampleAt(list: Sample[], time: number, out: Sample): boolean {
  if (list.length < 2) {
    return false;
  }
  if (time <= list[0].t) {
    out.t = list[0].t;
    out.s = list[0].s;
    out.x = list[0].x;
    out.h = list[0].h;
    out.p = list[0].p;
    return true;
  }
  const last = list[list.length - 1];
  if (time >= last.t) {
    out.t = last.t;
    out.s = last.s;
    out.x = last.x;
    out.h = last.h;
    out.p = last.p;
    return true;
  }
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].t < time) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const b = list[lo];
  const a = list[lo - 1] || b;
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
  out.h = a.h + wrapH(b.h - a.h) * u;
  out.p = a.p + (b.p - a.p) * u;
  return true;
}

function resample(samples: Sample[], hz: number): Sample[] {
  if (samples.length < 2) {
    return samples.map((s) => ({ t: s.t, s: s.s, x: s.x, h: s.h, p: s.p }));
  }
  const end = samples[samples.length - 1].t;
  const tmp: Sample = { t: 0, s: 0, x: 0, h: 0, p: 0 };
  const out: Sample[] = [];
  const step = 1 / hz;
  for (let t = samples[0].t; t < end; t += step) {
    sampleAt(samples, t, tmp);
    out.push({ t: tmp.t, s: tmp.s, x: tmp.x, h: tmp.h, p: tmp.p });
  }
  const last = samples[samples.length - 1];
  out.push({ t: last.t, s: last.s, x: last.x, h: last.h, p: last.p });
  return out;
}

function write16(buf: Uint8Array, o: number, v: number): void {
  const n = Math.max(0, Math.min(65535, v | 0));
  buf[o] = n >> 8;
  buf[o + 1] = n & 255;
}

export function packGhost(samples: Sample[], local = false): string {
  const src = resample(samples, local ? LOCAL_HZ : GHOST_HZ);
  const n = src.length;
  const wide = local;
  const buf = new Uint8Array(wide ? 1 + n * 8 : n * 6);
  const span = trackLen || 1;
  let o = 0;
  if (wide) {
    buf[0] = 2;
    o = 1;
  }
  for (let i = 0; i < n; i++) {
    write16(buf, o, (src[i].t / TIME_SPAN) * 65535);
    write16(buf, o + 2, (src[i].s / span) * 65535);
    if (wide) {
      write16(buf, o + 4, (src[i].x / X_SPAN) * 32767 + 32768);
      write16(buf, o + 6, (wrapH(src[i].h) / Math.PI) * 32767 + 32768);
      o += 8;
    } else {
      buf[o + 4] = Math.max(0, Math.min(255, ((src[i].x / X_SPAN) * 127 + 128) | 0));
      buf[o + 5] = Math.max(0, Math.min(255, ((wrapH(src[i].h) / Math.PI + 1) * 0.5 * 255) | 0));
      o += 6;
    }
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
    if (raw.length > 8 && raw.charCodeAt(0) === 2 && (raw.length - 1) % 8 === 0) {
      const span = trackLen || 1;
      for (let i = 1; i + 7 < raw.length; i += 8) {
        const t16 = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
        const s16 = (raw.charCodeAt(i + 2) << 8) | raw.charCodeAt(i + 3);
        const x16 = (raw.charCodeAt(i + 4) << 8) | raw.charCodeAt(i + 5);
        const h16 = (raw.charCodeAt(i + 6) << 8) | raw.charCodeAt(i + 7);
        out.push({
          t: (t16 / 65535) * TIME_SPAN,
          s: (s16 / 65535) * span,
          x: ((x16 - 32768) / 32767) * X_SPAN,
          h: ((h16 - 32768) / 32767) * Math.PI,
          p: 0,
        });
      }
      return out;
    }
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
          p: 0,
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
        p: 0,
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
  return sampleAt(play, time, out);
}
