export const NAME_MAX = 13;
export let playerId = '';
export let playerName = '';
export let best = 0;
export let localGhost = '';

const KEY = 'uc26';

function newPlayerId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < bytes.length; i++) {
    id += bytes[i].toString(16).padStart(2, '0');
  }
  return id.toUpperCase();
}

export function playerLabel(): string {
  return playerName || playerId;
}

export function setPlayerName(raw: string): void {
  playerName = raw.replace(/[^\w\- ]+/g, '').trim().slice(0, NAME_MAX);
  saveGame();
}

export function loadSave(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as { i?: string; n?: string; b?: number; g?: string };
      playerId = data.i && data.i.length ? data.i : '';
      playerName = data.n ? String(data.n).slice(0, NAME_MAX) : '';
      best = (data.b ?? 0) | 0;
      localGhost = data.g ? String(data.g) : '';
    }
  } catch {
    // private mode / corrupt
  }
  if (!playerId) {
    playerId = newPlayerId();
    saveGame();
  }
}

function saveGame(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, i: playerId, n: playerName, b: best, g: localGhost }));
  } catch {
    // private mode
  }
}

export function noteBest(timeMs: number, ghost: string): boolean {
  if (timeMs < 1) {
    return false;
  }
  if (!best || timeMs < best) {
    best = timeMs;
    localGhost = ghost;
    saveGame();
    return true;
  }
  return false;
}
