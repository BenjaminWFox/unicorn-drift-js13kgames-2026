/**
 * Gossip ladder seeder for UniCARn.
 * Not part of the game zip. Pulses the board so new clients can catch up.
 *
 *   npm run seed
 *
 * Env: WS_URL, PULSE_MS (default 3000), BOARD_FILE
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAME_MAX = 13;
const CAP = 12;
const MAX_SCORE = 1e6;
const MAX_MSG = 4000;
const WS_URL = process.env.WS_URL || 'wss://relay.js13kgames.com/unicarn';
const PULSE_MS = Math.max(1000, +process.env.PULSE_MS || 3000);
const BOARD_FILE = resolve(
  process.env.BOARD_FILE || `${dirname(fileURLToPath(import.meta.url))}/ladder-board.json`
);

/** @typedef {{ i: string, n: string, s: number, t: number }} Row */
/** @typedef {{ i: string, n: string, t: number, d: string }} Ghost */

/** @type {Row[]} */
let rows = [];
/** @type {Ghost | undefined} */
let topGhost;
/** @type {WebSocket | undefined} */
let sock;
let pulseTimer = 0;
let stopping = false;

loadBoard();
connect();
pulseTimer = setInterval(pulse, PULSE_MS);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function loadBoard() {
  try {
    const data = JSON.parse(readFileSync(BOARD_FILE, 'utf8'));
    rows = readRows(data.r);
    topGhost = readGhost(data.g);
  } catch {
    rows = [];
  }
  log('loaded', `${rows.length} rows from ${BOARD_FILE}`);
}

function persist() {
  writeFileSync(BOARD_FILE, JSON.stringify({ r: pack(ranked()), g: topGhost }));
}

function ranked() {
  return rows.slice().sort((a, b) => a.s - b.s || a.t - b.t);
}

/** @param {Row[]} list */
function pack(list) {
  return list.slice(0, CAP).map((r) => [r.i, r.n, r.s, r.t]);
}

/** @param {string} raw */
function cleanName(raw) {
  return raw
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .slice(0, NAME_MAX);
}

/** @param {unknown} raw */
function readGhost(raw) {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const o = /** @type {Ghost} */ (raw);
  const id = String(o.i ?? '')
    .replace(/[^\w-]/g, '')
    .slice(0, 16);
  const d = String(o.d ?? '');
  const t = o.t | 0;
  if (!id || !d || t < 1 || t > MAX_SCORE) {
    return undefined;
  }
  return { i: id, n: cleanName(String(o.n ?? '')) || id, t, d };
}

/** @param {unknown} raw */
function readRows(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const now = Date.now();
  /** @type {Row[]} */
  const out = [];
  /** @type {Record<string, Row>} */
  const seen = {};
  for (let i = 0; i < raw.length && out.length < CAP + 4; i++) {
    const item = raw[i];
    let id = '';
    let name = '';
    let score = 0;
    let ts = 0;
    if (Array.isArray(item)) {
      id = String(item[0] ?? '');
      name = String(item[1] ?? '');
      score = item[2] | 0;
      ts = +item[3] || 0;
    } else if (item && typeof item === 'object') {
      const o = /** @type {Row} */ (item);
      id = String(o.i ?? '');
      name = String(o.n ?? '');
      score = o.s | 0;
      ts = +o.t || 0;
    }
    id = id.replace(/[^\w-]/g, '').slice(0, 16);
    name = cleanName(name) || id;
    if (!id || score < 1 || score > MAX_SCORE || ts < 1 || ts > now + 864e5) {
      continue;
    }
    const prev = seen[id];
    if (prev && (prev.s < score || (prev.s === score && prev.t <= ts))) {
      continue;
    }
    const row = { i: id, n: name, s: score, t: ts };
    if (prev) {
      out[out.indexOf(prev)] = row;
    } else {
      out.push(row);
    }
    seen[id] = row;
  }
  return out;
}

/** @param {Row[]} incoming @param {Ghost | undefined} ghost */
function merge(incoming, ghost) {
  const before = JSON.stringify({ r: pack(ranked()), g: topGhost });
  for (const row of incoming) {
    const prev = rows.find((r) => r.i === row.i);
    if (!prev) {
      rows.push(row);
      continue;
    }
    if (row.s < prev.s || (row.s === prev.s && row.t < prev.t)) {
      prev.s = row.s;
      prev.t = row.t;
      prev.n = row.n;
    } else if (row.s === prev.s && row.n) {
      prev.n = row.n;
    }
  }
  if (ghost && (!topGhost || ghost.t < topGhost.t)) {
    topGhost = ghost;
  }
  rows = ranked().slice(0, CAP);
  persist();
  return JSON.stringify({ r: pack(ranked()), g: topGhost }) !== before;
}

function payload() {
  const body = { r: pack(ranked()), g: topGhost };
  return JSON.stringify(body);
}

function send() {
  if (sock?.readyState !== 1) {
    return;
  }
  const text = payload();
  if (text.length > MAX_MSG) {
    return;
  }
  sock.send(text);
}

function pulse() {
  if (sock?.readyState !== 1) {
    return;
  }
  send();
  log('pulse', status());
}

/** @param {string} data */
function onMessage(data) {
  if (data.length > MAX_MSG) {
    return;
  }
  try {
    const msg = JSON.parse(data);
    const incoming = readRows(msg.r);
    const ghost = readGhost(msg.g);
    if ((incoming.length || ghost) && merge(incoming, ghost)) {
      log('merge', status());
      send();
    }
  } catch {
    // ignore
  }
}

function connect() {
  try {
    const ws = new WebSocket(WS_URL);
    sock = ws;
    ws.addEventListener('open', () => {
      log('open', WS_URL);
      send();
    });
    ws.addEventListener('message', (e) => {
      if (typeof e.data === 'string') {
        onMessage(e.data);
      }
    });
    ws.addEventListener('close', () => {
      if (sock === ws) {
        sock = undefined;
      }
      if (stopping) {
        return;
      }
      log('close', 'reconnect in 2.5s');
      setTimeout(connect, 2500);
    });
    ws.addEventListener('error', () => {
      ws.close();
    });
  } catch (err) {
    log('error', String(err));
    setTimeout(connect, 4000);
  }
}

function status() {
  const top = ranked()[0];
  return top ? `${rows.length} rows, top ${top.s} ${top.n}` : 'empty';
}

/** @param {string} event @param {string} detail */
function log(event, detail) {
  console.log(`${new Date().toISOString()} ${event} ${detail}`);
}

function shutdown() {
  stopping = true;
  clearInterval(pulseTimer);
  persist();
  sock?.close();
  process.exit(0);
}
