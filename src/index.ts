import { updateAudio } from './audio';
import {
  CAM_BACK,
  CAM_HEIGHT,
  CAM_LOOK,
  CAM_LOOK_Y,
  SKY_B,
  SKY_G,
  SKY_R,
} from './constants';
import { ghostAt, ghostClock, hasGhost, recordTick, type Sample } from './ghost';
import { beginFrame, initGl, resizeGl, setSky } from './gl';
import { clearFrameInput, held, initInput, wasPressed } from './input';
import { initLadder } from './ladder';
import { lookAt, mat4 } from './math';
import { surface, type Frame } from './path';
import {
  countdown,
  falling,
  finished,
  fwd,
  glued,
  ghostPose,
  heading,
  hop,
  idleTitle,
  pose,
  resetPlayer,
  right,
  s,
  slip,
  slideCharge,
  speed,
  syncPose,
  up,
  updatePlayer,
  vel,
  velR,
  velU,
  wheel,
  x,
} from './player';
import { drawRoad } from './road';
import { loadSave } from './save';
import { drawSparks } from './sparks';
import { drawStars } from './stars';
import {
  drawUi,
  handleMenuKey,
  handleTap,
  pauseGame,
  resumeGame,
  SCENE_PAUSE,
  SCENE_RUN,
  SCENE_TITLE,
  scene,
  setViewSize,
  tickFinish,
} from './ui';
import { drawUnicarn } from './unicarn';

const canvas = document.querySelector('#c') as HTMLCanvasElement;
const uiCanvas = document.querySelector('#u') as HTMLCanvasElement;
const ui = uiCanvas.getContext('2d') as CanvasRenderingContext2D;
const view = mat4();
const gPose: Frame = {
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
const gF = [0, 0, 1];
const gN = [1, 0, 0];
const gU = [0, 1, 0];
const gSamp: Sample = { t: 0, s: 0, x: 0, h: 0, p: 0 };
const camFr: Frame = {
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
const camEye = [0, 6, -10];
const camAt = [0, 1, 8];
const camUpS = [0, 1, 0];
let camStick = 0;

let last = 0;

function viewSize(): { w: number; h: number } {
  const vv = window.visualViewport;
  if (vv) {
    return { w: vv.width, h: vv.height };
  }
  return { w: window.innerWidth, h: window.innerHeight };
}

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { w, h } = viewSize();
  for (const el of [canvas, uiCanvas]) {
    el.width = (w * dpr) | 0;
    el.height = (h * dpr) | 0;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  }
  resizeGl(canvas.width, canvas.height);
  ui.setTransform(dpr, 0, 0, dpr, 0, 0);
  setViewSize(w, h);
}

function renderWorld(dt: number): void {
  if (scene === SCENE_TITLE) {
    idleTitle();
  } else {
    syncPose();
  }
  const px = pose.x;
  const py = pose.y;
  const pz = pose.z;
  const onTitle = scene === SCENE_TITLE;
  const tx = onTitle ? fwd[0] : vel[0];
  const ty = falling > 0 ? 0 : onTitle ? fwd[1] : vel[1];
  const tz = onTitle ? fwd[2] : vel[2];
  const fl = Math.hypot(tx, ty, tz) || 1;
  const fx = tx / fl;
  const fy = ty / fl;
  const fz = tz / fl;
  const ux = falling > 0 ? 0 : onTitle ? up[0] : velU[0];
  const uy = falling > 0 ? 1 : onTitle ? up[1] : velU[1];
  const uz = falling > 0 ? 0 : onTitle ? up[2] : velU[2];
  const sx = onTitle ? right[0] : velR[0];
  const sy = onTitle ? right[1] : velR[1];
  const sz = onTitle ? right[2] : velR[2];
  const side = onTitle ? 3.2 : glued ? 0 : -slip * 2.6;
  // Keep the chase cam mostly level on hills; only loops should roll with the ribbon.
  const level = Math.max(0, Math.min(1, (uy - 0.32) / 0.58));
  const keep = 1 - level * 0.82;
  let cux = ux * keep;
  let cuy = uy * keep + level * 0.82;
  let cuz = uz * keep;
  let cl = Math.hypot(cux, cuy, cuz) || 1;
  cux /= cl;
  cuy /= cl;
  cuz /= cl;
  let cfx = fx;
  let cfy = fy * (1 - level * 0.78);
  let cfz = fz;
  cl = Math.hypot(cfx, cfy, cfz) || 1;
  cfx /= cl;
  cfy /= cl;
  cfz /= cl;
  const lookS = onTitle ? 8 : 15;
  surface(s + lookS, onTitle ? x : x * 0.18, 1.35, camFr);
  let fEx = px - cfx * CAM_BACK + cux * CAM_HEIGHT + sx * side;
  let fEy = py - cfy * CAM_BACK + cuy * CAM_HEIGHT + sy * side;
  let fEz = pz - cfz * CAM_BACK + cuz * CAM_HEIGHT + sz * side;
  let fLx = falling > 0 ? px + fx * CAM_LOOK : camFr.x;
  let fLy = falling > 0 ? py + CAM_LOOK_Y : camFr.y;
  let fLz = falling > 0 ? pz + fz * CAM_LOOK : camFr.z;
  surface(s - CAM_BACK, x * 0.2, CAM_HEIGHT + 1.4, camFr);
  const want = !onTitle && falling <= 0 && glued ? 1 : 0;
  camStick += (want - camStick) * (1 - Math.exp(-6.5 * dt));
  const t = camStick * camStick * (3 - 2 * camStick);
  const ex = fEx + (camFr.x - fEx) * t;
  const ey = fEy + (camFr.y - fEy) * t;
  const ez = fEz + (camFr.z - fEz) * t;
  const lx = fLx + (px + fx * 2 + ux * CAM_LOOK_Y - fLx) * t;
  const ly = fLy + (py + fy * 2 + uy * CAM_LOOK_Y - fLy) * t;
  const lz = fLz + (pz + fz * 2 + uz * CAM_LOOK_Y - fLz) * t;
  cux += (camFr.ux - cux) * t;
  cuy += (camFr.uy - cuy) * t;
  cuz += (camFr.uz - cuz) * t;
  cl = Math.hypot(cux, cuy, cuz) || 1;
  const jump = Math.hypot(ex - camEye[0], ey - camEye[1], ez - camEye[2]);
  const k = jump > 28 ? 1 : 1 - Math.exp(-(onTitle ? 14 : 8.5) * dt);
  camEye[0] += (ex - camEye[0]) * k;
  camEye[1] += (ey - camEye[1]) * k;
  camEye[2] += (ez - camEye[2]) * k;
  camAt[0] += (lx - camAt[0]) * k;
  camAt[1] += (ly - camAt[1]) * k;
  camAt[2] += (lz - camAt[2]) * k;
  camUpS[0] += (cux / cl - camUpS[0]) * k;
  camUpS[1] += (cuy / cl - camUpS[1]) * k;
  camUpS[2] += (cuz / cl - camUpS[2]) * k;
  lookAt(view, camEye[0], camEye[1], camEye[2], camAt[0], camAt[1], camAt[2], camUpS[0], camUpS[1], camUpS[2]);
  beginFrame();
  drawStars(view);
  drawRoad(view);
  if ((scene === SCENE_RUN || scene === SCENE_PAUSE) && hasGhost() && ghostAt(ghostClock(), gSamp)) {
    ghostPose(gSamp.s, gSamp.x, gSamp.h, gPose, gF, gN, gU, gSamp.p);
    drawUnicarn(
      view,
      gPose.x,
      gPose.y,
      gPose.z,
      gN[0],
      gN[1],
      gN[2],
      gU[0],
      gU[1],
      gU[2],
      gF[0],
      gF[1],
      gF[2],
      gSamp.s * 2,
      0,
      true
    );
  }
  drawUnicarn(
    view,
    pose.x,
    pose.y,
    pose.z,
    right[0],
    right[1],
    right[2],
    up[0],
    up[1],
    up[2],
    fwd[0],
    fwd[1],
    fwd[2],
    wheel,
    slip,
    false
  );
  drawSparks(view);
}

function runInput(): void {
  if (wasPressed('KeyP') || wasPressed('Escape')) {
    if (scene === SCENE_PAUSE) {
      resumeGame();
    } else {
      pauseGame();
    }
  }
}

function frame(now: number): void {
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
  last = now;
  handleTap();
  if (scene === SCENE_RUN) {
    runInput();
    updatePlayer(dt);
    if (countdown <= 0) {
      recordTick(dt, s, x, heading, hop);
    }
    tickFinish();
  } else {
    handleMenuKey();
  }
  updateAudio(
    dt,
    speed,
    held('ArrowUp') || held('KeyW') ? 1 : 0,
    scene === SCENE_RUN && !finished ? 1 : 0,
    countdown,
    slideCharge
  );
  renderWorld(dt);
  drawUi(ui);
  clearFrameInput();
  requestAnimationFrame(frame);
}

function main(): void {
  loadSave();
  initGl(canvas);
  setSky(SKY_R, SKY_G, SKY_B);
  initInput(uiCanvas);
  initLadder();
  resetPlayer();
  resize();
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  requestAnimationFrame(frame);
}

main();
