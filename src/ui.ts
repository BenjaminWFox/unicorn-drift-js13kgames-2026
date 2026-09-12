import { armCountdown, unlockAudio } from './audio';
import { FONT, LAPS, RAINBOW, SLIDE_CHARGE } from './constants';
import { packGhost, recorded, resetRecord, setPlayback } from './ghost';
import { tapX, tapY, wasPressed } from './input';
import { boardRows, formatTime, ghostLabel, publishName, publishScore } from './ladder';
import { rgb } from './math';
import {
  countdown,
  currentLap,
  finished,
  lastTime,
  raceTime,
  resetPlayer,
  slide,
  slideCharge,
} from './player';
import { best, NAME_MAX, noteBest, playerId, playerName, setPlayerName } from './save';

export const SCENE_TITLE = 0;
export const SCENE_RUN = 1;
export const SCENE_PAUSE = 2;
export const SCENE_FINISH = 3;
export const SCENE_SCORES = 4;

export let scene = SCENE_TITLE;
let cssW = 1;
let cssH = 1;
let focus = 0;
let newBest = false;
let finishMs = 0;
let finishFocusAt = 0;

type Btn = { x: number; y: number; w: number; h: number; label: string; id: number };
const btns: Btn[] = [];
const nameBox = { x: 0, y: 0, w: 0, h: 0 };
const ghostPlate = { x: 0, y: 0, on: 0 };
let nameField: HTMLInputElement | undefined;

export function setGhostPlate(x: number, y: number, on: number): void {
  ghostPlate.x = x;
  ghostPlate.y = y;
  ghostPlate.on = on;
}

export function setViewSize(w: number, h: number): void {
  cssW = w;
  cssH = h;
}

export function startRun(): void {
  unlockAudio();
  armCountdown();
  resetPlayer();
  resetRecord();
  scene = SCENE_RUN;
  focus = 0;
  newBest = false;
  syncNameField(false);
}

export function finishRace(): void {
  finishMs = (lastTime * 1000) | 0;
  const raw = recorded().slice();
  newBest = noteBest(finishMs, packGhost(raw, true));
  if (newBest) {
    publishScore(packGhost(raw));
    setPlayback(raw);
  }
  scene = SCENE_FINISH;
  focus = -1;
  finishFocusAt = performance.now() + 1000;
}

export function pauseGame(): void {
  if (scene === SCENE_RUN) {
    scene = SCENE_PAUSE;
    focus = 0;
  }
}

export function resumeGame(): void {
  if (scene === SCENE_PAUSE) {
    scene = SCENE_RUN;
  }
}

function addBtn(x: number, y: number, w: number, h: number, label: string, id: number): void {
  btns.push({ x, y, w, h, label, id });
}

function clickBtn(x: number, y: number): number {
  for (const b of btns) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      return b.id;
    }
  }
  return -1;
}

function plate(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign,
  fill = '#fff'
): void {
  ctx.font = '600 ' + size + 'px ' + FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const m = ctx.measureText(text);
  const visL = m.actualBoundingBoxLeft;
  const visR = m.actualBoundingBoxRight;
  const drawX = align === 'center' ? x - (visR - visL) * 0.5 : align === 'right' ? x - visR : x;
  const padX = Math.max(12, size * 0.35);
  const padY = Math.max(24, size * 0.55);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(drawX - visL - padX, y - padY, visL + visR + padX * 2, padY * 2);
  ctx.fillStyle = fill;
  ctx.fillText(text, drawX, y);
}

function rainbowTitle(ctx: CanvasRenderingContext2D, text: string, y: number, size: number): void {
  ctx.font = '800 ' + size + 'px ' + FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const total = ctx.measureText(text).width;
  let x = cssW * 0.5 - total * 0.5;
  let ci = 0;
  for (const ch of text) {
    const col = rgb(RAINBOW[ci % 7]);
    ctx.fillStyle = '#000';
    ctx.fillText(ch, x + 2, y + 2);
    ctx.fillStyle =
      'rgb(' + ((col[0] * 255) | 0) + ',' + ((col[1] * 255) | 0) + ',' + ((col[2] * 255) | 0) + ')';
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width;
    if (ch !== ' ') {
      ci++;
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSlideBar(ctx: CanvasRenderingContext2D): void {
  if (slide <= 0 && slideCharge <= 0.02) {
    return;
  }
  const w = Math.min(480, cssW * 0.72);
  const h = 56;
  const x = cssW * 0.5 - w * 0.5;
  const y = cssH - 78;
  ctx.save();
  ctx.globalAlpha = slide > 0 ? 1 : Math.min(1, slideCharge * 3);
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  roundRect(ctx, x - 8, y - 8, w + 16, h + 16, 12);
  ctx.fill();
  ctx.fillStyle = '#1a1022';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, y, w, h, 8);
  ctx.clip();
  const filled = w * slideCharge;
  for (let i = 0; i < 7; i++) {
    const bx = x + (w * i) / 7;
    if (bx >= x + filled) {
      break;
    }
    const c = rgb(RAINBOW[i]);
    ctx.fillStyle =
      'rgb(' + ((c[0] * 255) | 0) + ',' + ((c[1] * 255) | 0) + ',' + ((c[2] * 255) | 0) + ')';
    ctx.fillRect(bx, y, Math.min(w / 7 + 1, x + filled - bx), h);
  }
  ctx.restore();
  const minX = x + w * (0.2 / SLIDE_CHARGE);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(minX, y - 4, 4, h + 8);
  ctx.fillStyle = '#ffd24a';
  ctx.fillRect(x + w - 5, y - 4, 5, h + 8);
  const g = slideCharge < 0.75 ? 0 : Math.min(1, 0.2 + 0.8 * ((slideCharge - 0.75) / 0.25));
  const pulse = g >= 1 ? 0.62 + 0.38 * Math.abs(Math.sin(raceTime * 14)) : 1;
  roundRect(ctx, x - 8, y - 8, w + 16, h + 16, 12);
  if (g) {
    ctx.shadowColor = '#ffd24a';
    ctx.shadowBlur = (10 + g * 34) * pulse;
    ctx.strokeStyle = 'rgba(255,210,74,' + (0.3 + 0.7 * g) * pulse + ')';
    ctx.lineWidth = 2.5 + g * 3.5 * pulse;
    ctx.stroke();
    ctx.shadowBlur = (22 + g * 48) * pulse;
    ctx.lineWidth = 7 + g * 12 * pulse;
    ctx.strokeStyle = 'rgba(255,210,74,' + (0.1 + 0.28 * g) * pulse + ')';
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
  }
  ctx.stroke();
  ctx.restore();
}

function drawBtns(ctx: CanvasRenderingContext2D): void {
  ctx.font = '700 20px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < btns.length; i++) {
    const b = btns[i];
    ctx.fillStyle = i === focus ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.55)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.fillStyle = i === focus ? '#111' : '#fff';
    ctx.fillText(b.label, b.x + b.w * 0.5, b.y + b.h * 0.5);
  }
}

function ensureNameField(): HTMLInputElement {
  if (nameField) {
    return nameField;
  }
  const el = document.createElement('input');
  el.id = 'name';
  el.maxLength = NAME_MAX;
  el.placeholder = playerId;
  el.autocomplete = 'off';
  document.body.appendChild(el);
  nameField = el;
  return el;
}

function syncNameField(on: boolean): void {
  const el = ensureNameField();
  if (!on) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.style.left = nameBox.x + 'px';
  el.style.top = nameBox.y + 'px';
  el.style.width = nameBox.w + 'px';
  el.style.height = nameBox.h + 'px';
  if (document.activeElement !== el) {
    el.value = playerName;
  }
}

function commitName(): void {
  const el = ensureNameField();
  setPlayerName(el.value);
  el.value = playerName;
  publishName();
}

function drawLadder(ctx: CanvasRenderingContext2D, left: number, y: number, slots: number): void {
  const rows = boardRows(slots);
  const lineH = 24;
  const w = Math.min(420, cssW * 0.72);
  const h = lineH * slots + 20;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, left, y, w, h, 10);
  ctx.fill();
  ctx.font = '600 16px ' + FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < slots; i++) {
    const row = rows[i];
    const ly = y + 12 + lineH * (i + 0.5);
    const label = row ? i + 1 + '  ' + formatTime(row.s) + '  ' + row.n : i + 1 + '  ...';
    if (row?.self) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundRect(ctx, left + 8, ly - 10, w - 16, 20, 6);
      ctx.fill();
      ctx.fillStyle = '#111';
    } else {
      ctx.fillStyle = '#fff';
    }
    ctx.fillText(label, left + 16, ly);
  }
}

function hit(id: number): void {
  if (scene === SCENE_TITLE) {
    if (id === 0) {
      startRun();
    }
    if (id === 1) {
      scene = SCENE_SCORES;
      focus = 0;
    }
    if (id === 2) {
      commitName();
    }
    return;
  }
  if (scene === SCENE_PAUSE) {
    if (id === 0) {
      resumeGame();
    }
    if (id === 1) {
      scene = SCENE_TITLE;
    }
    return;
  }
  if (scene === SCENE_FINISH) {
    if (id === 0) {
      startRun();
    }
    if (id === 1) {
      scene = SCENE_TITLE;
      focus = 0;
    }
    if (id === 2) {
      commitName();
    }
    return;
  }
  if (scene === SCENE_SCORES) {
    if (id === 0) {
      commitName();
    }
    if (id === 1) {
      scene = SCENE_TITLE;
      focus = 0;
    }
  }
}

export function handleTap(): void {
  if (tapX < 0) {
    return;
  }
  const id = clickBtn(tapX, tapY);
  if (id >= 0) {
    hit(id);
  }
}

export function handleMenuKey(): void {
  if (wasPressed('ArrowDown') || wasPressed('KeyS')) {
    focus = Math.min(btns.length - 1, focus + 1);
  }
  if (wasPressed('ArrowUp') || wasPressed('KeyW')) {
    focus = Math.max(0, focus - 1);
  }
  if (wasPressed('Enter') || wasPressed('Space')) {
    if (btns[focus]) {
      hit(btns[focus].id);
    }
  }
  if (wasPressed('Escape') && (scene === SCENE_SCORES || scene === SCENE_FINISH)) {
    scene = SCENE_TITLE;
    focus = 0;
  }
}

export function drawUi(ctx: CanvasRenderingContext2D): void {
  btns.length = 0;
  ctx.clearRect(0, 0, cssW, cssH);
  const mid = cssW * 0.5;
  const bw = Math.min(280, cssW * 0.7);

  if (scene === SCENE_TITLE) {
    rainbowTitle(ctx, 'UNICORN DRIFT', cssH * 0.11, Math.min(56, cssW * 0.085));
    plate(ctx, 'BEST  ' + formatTime(best), mid, cssH * 0.22, 28, 'center', '#ffd24a');
    const startY = cssH - 176;
    addBtn(mid - bw * 0.5, startY, bw, 52, 'START', 0);
    nameBox.x = mid - bw * 0.5;
    nameBox.y = startY + 60;
    nameBox.w = bw * 0.5;
    nameBox.h = 44;
    addBtn(nameBox.x + nameBox.w + 8, nameBox.y, bw * 0.5 - 8, 44, 'SET NAME', 2);
    addBtn(mid - bw * 0.5, startY + 112, bw, 44, 'HIGH SCORES', 1);
    drawBtns(ctx);
    syncNameField(true);
    return;
  }

  if (scene === SCENE_SCORES) {
    rainbowTitle(ctx, 'UNICORN DRIFT', cssH * 0.12, Math.min(36, cssW * 0.07));
    nameBox.x = mid - 210;
    nameBox.y = cssH * 0.22;
    nameBox.w = 260;
    nameBox.h = 44;
    addBtn(mid + 58, cssH * 0.22, 152, 44, 'UPDATE NAME', 0);
    drawLadder(ctx, mid - 210, cssH * 0.32, 10);
    addBtn(mid - 140, cssH * 0.86, 280, 48, 'BACK', 1);
    drawBtns(ctx);
    syncNameField(true);
    return;
  }

  syncNameField(false);

  if (scene === SCENE_RUN || scene === SCENE_PAUSE) {
    plate(ctx, formatTime((raceTime * 1000) | 0), mid, 28, 22, 'center');
    plate(ctx, 'LAP  ' + currentLap() + '/' + LAPS, 70, 28, 16, 'left');
    plate(ctx, 'BEST  ' + formatTime(best), cssW - 24, 28, 16, 'right', '#ffd24a');
    if (ghostPlate.on) {
      plate(ctx, ghostLabel(), ghostPlate.x, ghostPlate.y, 14, 'center');
    }
    drawSlideBar(ctx);
    if (countdown > 0) {
      const n = Math.ceil(countdown);
      rainbowTitle(ctx, n > 0 && countdown > 0.15 ? String(n) : 'GO', cssH * 0.42, 96);
    }
    if (scene === SCENE_PAUSE) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, cssW, cssH);
      plate(ctx, 'PAUSED', mid, cssH * 0.36, 28, 'center');
      addBtn(mid - 130, cssH * 0.48, 260, 48, 'RESUME', 0);
      addBtn(mid - 130, cssH * 0.48 + 58, 260, 48, 'QUIT', 1);
      drawBtns(ctx);
    }
    return;
  }

  if (scene === SCENE_FINISH) {
    rainbowTitle(ctx, 'FINISH', cssH * 0.16, 168);
    plate(ctx, formatTime(finishMs), mid, cssH * 0.34, 56, 'center', newBest ? '#ffd24a' : '#fff');
    if (newBest) {
      plate(ctx, 'NEW BEST!', mid, cssH * 0.46, 40, 'center', '#ffd24a');
    }
    nameBox.x = mid - 210;
    nameBox.y = cssH * 0.54;
    nameBox.w = 260;
    nameBox.h = 44;
    addBtn(mid + 58, cssH * 0.54, 152, 44, 'UPDATE NAME', 2);
    drawLadder(ctx, mid - 210, cssH * 0.62, 5);
    addBtn(mid - 210, cssH * 0.84, 200, 48, 'RACE AGAIN', 0);
    addBtn(mid + 10, cssH * 0.84, 200, 48, 'MENU', 1);
    if (focus < 0 && performance.now() >= finishFocusAt) {
      for (let i = 0; i < btns.length; i++) {
        if (btns[i].id === 0) {
          focus = i;
          break;
        }
      }
    }
    drawBtns(ctx);
    syncNameField(true);
  }
}

export function tickFinish(): void {
  if (scene === SCENE_RUN && finished) {
    finishRace();
  }
}
