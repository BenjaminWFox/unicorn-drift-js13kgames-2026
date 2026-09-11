import {
  ACCEL,
  BRAKE,
  COUNTDOWN,
  DRAG,
  FALL_TIME,
  HOP_GRAV,
  JUMP_VEL,
  LAPS,
  LIP,
  MAX_REV,
  MAX_SPEED,
  PAD_SPEED,
  PAD_TIME,
  PENALTY,
  EXIT_ALIGN,
  GRIP_FOLLOW,
  SLIDE_BOOST,
  SLIDE_CHARGE,
  SLIDE_EXIT_BOOST,
  SLIDE_EXIT_KICK,
  SLIDE_HOOK,
  SLIDE_KICK,
  SLIDE_SLIP,
  SLIDE_STEER,
  SLIDE_TIME,
  STEER,
} from './constants';
import { held, wasPressed } from './input';
import { fallS, frameAt, headingAxes, surface, tangentYaw, trackLen, wrapS, type Frame } from './path';
import { onBoostPad } from './road';
import { burstPad, burstSparks, clearSparks, emitFlames, updateSparks } from './sparks';

export let s = 0;
export let x = 0;
export let heading = 0;
export let travel = 0;
export let slip = 0;
export let speed = 0;
export let hop = 0;
export let hopV = 0;
export let slide = 0;
export let slideCharge = 0;
let slideAge = 0;
let exitBoost = 0;
let padBoost = 0;
let cling = 0;
let fallSteep = 0;
export let glued = 0;
export let falling = 0;
export let fallY = 0;
export let countdown = COUNTDOWN;
export let raceTime = 0;
export let dist = 0;
export let finished = 0;
export let lastTime = 0;
export let wheel = 0;
export let boosting = 0;

export const pose: Frame = {
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

export const fwd = [0, 0, 1];
export const right = [1, 0, 0];
export const up = [0, 1, 0];
export const vel = [0, 0, 1];
export const velR = [1, 0, 0];
export const velU = [0, 1, 0];

const fallPos = [0, 0, 0];
const fallVel = [0, 0, 0];
const moveFr: Frame = {
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

function wrapDelta(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function facePath(): void {
  frameAt(s, moveFr);
  heading = tangentYaw(moveFr);
  travel = heading;
  slip = 0;
}

function chaseTravel(rate: number, dt: number): void {
  travel += wrapDelta(heading - travel) * (1 - Math.exp(-rate * dt));
}

function straighten(dt: number): void {
  heading -= wrapDelta(heading - travel) * (1 - Math.exp(-EXIT_ALIGN * dt));
}

function clampSlip(): void {
  slip = wrapDelta(heading - travel);
  if (slip > SLIDE_SLIP) {
    heading = travel + SLIDE_SLIP;
    slip = SLIDE_SLIP;
  } else if (slip < -SLIDE_SLIP) {
    heading = travel - SLIDE_SLIP;
    slip = -SLIDE_SLIP;
  }
}

export function onRibbon(fr: Frame): boolean {
  // Hills top out around 35°; only loops go vertical / invert.
  return Math.abs(fr.ty) > 0.7 || fr.uy < 0.48;
}

export function resetPlayer(): void {
  s = 0.4;
  x = 0;
  heading = 0;
  speed = 0;
  hop = 0;
  hopV = 0;
  slide = 0;
  slideAge = 0;
  slideCharge = 0;
  exitBoost = 0;
  padBoost = 0;
  cling = 0;
  fallSteep = 0;
  falling = 0;
  fallY = 0;
  countdown = COUNTDOWN;
  raceTime = 0;
  dist = 0.4;
  finished = 0;
  lastTime = 0;
  wheel = 0;
  boosting = 0;
  facePath();
  clearSparks();
  syncPose();
}

function steerInput(): number {
  let st = 0;
  // Chase cam looks along +forward; +heading is +normal, which reads as screen-left.
  if (held('ArrowLeft') || held('KeyA')) {
    st += 1;
  }
  if (held('ArrowRight') || held('KeyD')) {
    st -= 1;
  }
  return st;
}

function startFall(): void {
  falling = FALL_TIME;
  fallSteep = glued;
  fallPos[0] = pose.x;
  fallPos[1] = pose.y;
  fallPos[2] = pose.z;
  fallVel[0] = fwd[0] * speed * 0.35 + pose.nx * Math.sign(x) * 4;
  fallVel[1] = 2;
  fallVel[2] = fwd[2] * speed * 0.35 + pose.nz * Math.sign(x) * 4;
  speed = 0;
}

function respawn(): void {
  const oldS = wrapS(s);
  const ns = fallS(oldS, fallSteep);
  const back = wrapS(oldS - ns);
  x = 0;
  speed = 0;
  hop = 0;
  hopV = 0;
  slide = 0;
  slideAge = 0;
  slideCharge = 0;
  exitBoost = 0;
  padBoost = 0;
  cling = 0;
  falling = 0;
  fallSteep = 0;
  if (back < trackLen * 0.5 && dist >= back) {
    dist -= back;
    s = ns;
  } else {
    s = 0.4;
    dist = 0.4;
  }
  raceTime += PENALTY;
  facePath();
  syncPose();
}

export function syncPose(): void {
  if (falling > 0) {
    pose.x = fallPos[0];
    pose.y = fallPos[1];
    pose.z = fallPos[2];
    pose.ux = 0;
    pose.uy = 1;
    pose.uz = 0;
    pose.tx = fwd[0];
    pose.ty = fwd[1];
    pose.tz = fwd[2];
    return;
  }
  surface(s, x, hop, pose);
  glued = onRibbon(pose) ? 1 : 0;
  if (glued) {
    // Compass yaw is junk when T is vertical; cock facing around ribbon up.
    const c = Math.cos(slip);
    const sn = Math.sin(slip);
    fwd[0] = pose.tx * c + pose.nx * sn;
    fwd[1] = pose.ty * c + pose.ny * sn;
    fwd[2] = pose.tz * c + pose.nz * sn;
    right[0] = pose.nx * c - pose.tx * sn;
    right[1] = pose.ny * c - pose.ty * sn;
    right[2] = pose.nz * c - pose.tz * sn;
    up[0] = pose.ux;
    up[1] = pose.uy;
    up[2] = pose.uz;
    vel[0] = pose.tx;
    vel[1] = pose.ty;
    vel[2] = pose.tz;
    velR[0] = pose.nx;
    velR[1] = pose.ny;
    velR[2] = pose.nz;
    velU[0] = pose.ux;
    velU[1] = pose.uy;
    velU[2] = pose.uz;
    return;
  }
  headingAxes(pose, heading, fwd, right, up);
  headingAxes(pose, travel, vel, velR, velU);
}

export function updatePlayer(dt: number): void {
  if (finished) {
    updateSparks(dt);
    return;
  }
  if (countdown > 0) {
    countdown = Math.max(0, countdown - dt);
    heading += steerInput() * STEER * dt;
    travel = heading;
    slip = 0;
    syncPose();
    updateSparks(dt);
    return;
  }

  if (falling > 0) {
    falling -= dt;
    fallVel[1] -= 28 * dt;
    fallPos[0] += fallVel[0] * dt;
    fallPos[1] += fallVel[1] * dt;
    fallPos[2] += fallVel[2] * dt;
    syncPose();
    updateSparks(dt);
    if (falling <= 0) {
      respawn();
    }
    return;
  }

  const st = steerInput();
  const upKey = held('ArrowUp') || held('KeyW');
  const downKey = held('ArrowDown') || held('KeyS');
  if (upKey) {
    speed += ACCEL * dt;
  }
  if (downKey) {
    if (speed > 0.4) {
      speed -= BRAKE * dt;
    } else {
      speed -= ACCEL * 0.45 * dt;
    }
  }
  speed -= speed * DRAG * dt;
  if (!upKey && !downKey && Math.abs(speed) < 0.35) {
    speed = 0;
  }

  if (wasPressed('Space') && hop <= 0) {
    hopV = JUMP_VEL;
    hop = 0.02;
  }
  if (hop > 0) {
    hopV -= HOP_GRAV * dt;
    hop += hopV * dt;
    if (st && hopV > -2 && held('Space')) {
      if (slide <= 0) {
        heading += st * SLIDE_KICK;
        slideAge = 0;
      }
      slide = SLIDE_TIME;
    }
    if (hop <= 0) {
      hop = 0;
      hopV = 0;
    }
  }

  const turningOut = slide > 0 && st && slip && st * slip < 0;
  const wasSliding = slide > 0;
  if (slide > 0) {
    cling = 0.7;
    slideAge += dt;
    slideCharge = Math.min(1, slideAge / SLIDE_CHARGE);
    if (turningOut || !st || !held('Space')) {
      slide = 0;
    } else {
      slide -= dt * 0.22;
      if (slide < 0) {
        slide = 0;
      }
      boosting = SLIDE_BOOST;
      burstSparks(pose.x, pose.y, pose.z, vel, up, velR);
    }
  } else {
    cling = Math.max(0, cling - dt);
    boosting = 0;
    slideCharge = Math.max(0, slideCharge - dt * 3.6);
  }
  if (wasSliding && slide <= 0) {
    if (slideAge > 0.2) {
      const charge = Math.min(1, slideAge / SLIDE_CHARGE);
      exitBoost = Math.min(2.5, 0.28 + slideAge * 0.85);
      speed += SLIDE_EXIT_KICK * charge;
      emitFlames(pose.x, pose.y, pose.z, vel, up, velR, 14);
    }
    slideAge = 0;
  }
  if (exitBoost > 0) {
    exitBoost = Math.max(0, exitBoost - dt);
    boosting += SLIDE_EXIT_BOOST;
    emitFlames(pose.x, pose.y, pose.z, vel, up, velR, 3);
  }
  if (hop < 0.45 && onBoostPad(s, x, slip)) {
    if (padBoost <= 0) {
      speed += PAD_SPEED;
      burstPad(pose.x, pose.y, pose.z, vel, velU, velR, speed);
      emitFlames(pose.x, pose.y, pose.z, vel, up, velR, 8);
    }
    padBoost = PAD_TIME;
  }
  if (padBoost > 0) {
    padBoost = Math.max(0, padBoost - dt);
    boosting += PAD_SPEED;
    emitFlames(pose.x, pose.y, pose.z, vel, up, velR, 2);
  }

  const cap = MAX_SPEED + boosting;
  if (speed > cap) {
    speed = cap;
  }
  if (speed < -MAX_REV) {
    speed = -MAX_REV;
  }

  const grip = 0.52 + 0.46 * Math.min(1, Math.abs(speed) / 16);
  const holdingDrift = slide > 0 && st && !turningOut;
  if (holdingDrift) {
    heading += st * SLIDE_STEER * dt;
    chaseTravel(SLIDE_HOOK, dt);
    clampSlip();
  } else {
    heading += st * STEER * grip * dt;
    if (!st || turningOut || cling > 0) {
      straighten(dt);
    }
    chaseTravel(GRIP_FOLLOW, dt);
    slip = wrapDelta(heading - travel);
  }

  frameAt(s, moveFr);
  const steep = onRibbon(moveFr);
  if ((cling > 0 || turningOut) && !steep) {
    travel += wrapDelta(tangentYaw(moveFr) - travel) * (1 - Math.exp(-2.6 * dt));
    slip = wrapDelta(heading - travel);
  }
  const wx = Math.sin(travel);
  const wz = Math.cos(travel);
  const tH = Math.hypot(moveFr.tx, moveFr.tz);
  const nH = Math.hypot(moveFr.nx, moveFr.nz);
  const along = steep || tH < 0.18 ? 1 : (moveFr.tx * wx + moveFr.tz * wz) / tH;
  // World XZ vs path tangent is noise once T is vertical — that was yeeting the kart off.
  let side = 0;
  if (!steep && nH > 1e-4) {
    side = (moveFr.nx * wx + moveFr.nz * wz) / nH;
  } else if (steep && st) {
    side = nH > 1e-4 ? (moveFr.nx * wx + moveFr.nz * wz) / nH : 0;
  }
  if (cling > 0 || turningOut) {
    side *= 0.28;
  }
  const ds = speed * along * dt;
  let dx = speed * side * dt;
  if (x * dx > 0 && (cling > 0 || Math.abs(x) > LIP * 0.55)) {
    dx *= cling > 0 ? 0.08 : Math.max(0.1, 1 - (Math.abs(x) / LIP - 0.55) / 0.45);
  }
  s += ds;
  x += dx;
  dist += ds;
  if (s < 0) {
    s += trackLen;
  } else if (s >= trackLen) {
    s -= trackLen;
  }
  wheel += speed * dt * 2.4;

  if (Math.abs(x) > LIP) {
    if (steep && !st) {
      x = Math.sign(x) * (LIP - 0.12);
    } else if (cling > 0 || slide > 0 || Math.abs(slip) > 0.1) {
      x = Math.sign(x) * (LIP - 0.12);
      travel += wrapDelta(tangentYaw(moveFr) - travel) * 0.65;
      heading += wrapDelta(travel - heading) * 0.35;
      slip = wrapDelta(heading - travel);
      cling = Math.max(cling, 0.25);
    } else {
      startFall();
      syncPose();
      updateSparks(dt);
      return;
    }
  }

  if (dist >= trackLen * LAPS) {
    finished = 1;
    lastTime = raceTime;
    speed = 0;
  }

  raceTime += dt;
  syncPose();
  updateSparks(dt);
}

export function ghostPose(
  gs: number,
  gx: number,
  gh: number,
  out: Frame,
  F: number[],
  N: number[],
  Up: number[],
  hop = 0
): void {
  surface(gs, gx, hop, out);
  if (onRibbon(out)) {
    F[0] = out.tx;
    F[1] = out.ty;
    F[2] = out.tz;
    N[0] = out.nx;
    N[1] = out.ny;
    N[2] = out.nz;
    Up[0] = out.ux;
    Up[1] = out.uy;
    Up[2] = out.uz;
    return;
  }
  headingAxes(out, gh, F, N, Up);
}

export function currentLap(): number {
  return Math.min(LAPS, 1 + Math.floor(Math.max(0, dist) / trackLen));
}

export function idleTitle(): void {
  s = 14;
  x = 0;
  hop = 0;
  slide = 0;
  falling = 0;
  surface(s, x, 0, pose);
  heading = tangentYaw(pose);
  travel = heading;
  slip = 0;
  glued = 0;
  headingAxes(pose, heading, fwd, right, up);
  headingAxes(pose, travel, vel, velR, velU);
}
