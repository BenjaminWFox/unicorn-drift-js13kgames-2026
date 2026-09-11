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
import { clearFrameInput, initInput, wasPressed } from './input';
import { initLadder } from './ladder';
import { lookAt, mat4 } from './math';
import { type Frame } from './path';
import {
  countdown,
  falling,
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

function renderWorld(): void {
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
  lookAt(
    view,
    px - fx * CAM_BACK + ux * CAM_HEIGHT + sx * side,
    py - fy * CAM_BACK + uy * CAM_HEIGHT + sy * side,
    pz - fz * CAM_BACK + uz * CAM_HEIGHT + sz * side,
    px + fx * CAM_LOOK + ux * CAM_LOOK_Y,
    py + fy * CAM_LOOK + uy * CAM_LOOK_Y,
    pz + fz * CAM_LOOK + uz * CAM_LOOK_Y,
    ux,
    uy,
    uz
  );
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
  renderWorld();
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
