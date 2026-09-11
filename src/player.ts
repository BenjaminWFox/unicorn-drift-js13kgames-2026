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
  PENALTY,
  EXIT_ALIGN,
  GRIP_FOLLOW,
  SLIDE_BOOST,
  SLIDE_HOOK,
  SLIDE_KICK,
  SLIDE_SLIP,
  SLIDE_STEER,
  SLIDE_TIME,
  STEER,
} from './constants';
import { held, wasPressed } from './input';
import { frameAt, gateS, headingAxes, surface, tangentYaw, trackLen, type Frame } from './path';
import { burstSparks, clearSparks, updateSparks } from './sparks';

export let s = 0;
export let x = 0;
export let heading = 0;
export let travel = 0;
export let slip = 0;
export let speed = 0;
export let hop = 0;
export let hopV = 0;
export let slide = 0;
let cling = 0;
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

export function resetPlayer(): void {
  s = 0.4;
  x = 0;
  heading = 0;
  speed = 0;
  hop = 0;
  hopV = 0;
  slide = 0;
  cling = 0;
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
  fallPos[0] = pose.x;
  fallPos[1] = pose.y;
  fallPos[2] = pose.z;
  fallVel[0] = fwd[0] * speed * 0.35 + pose.nx * Math.sign(x) * 4;
  fallVel[1] = 2;
  fallVel[2] = fwd[2] * speed * 0.35 + pose.nz * Math.sign(x) * 4;
  speed = 0;
}

function respawn(): void {
  const gate = gateS(dist);
  const lap = Math.floor(Math.max(0, dist) / trackLen);
  s = gate + 0.5;
  x = 0;
  speed = 0;
  hop = 0;
  hopV = 0;
  slide = 0;
  cling = 0;
  falling = 0;
  dist = lap * trackLen + s;
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
    if (st && hopV > -2) {
      if (slide <= 0) {
        heading += st * SLIDE_KICK;
      }
      slide = SLIDE_TIME;
    }
    if (hop <= 0) {
      hop = 0;
      hopV = 0;
    }
  }

  const turningOut = slide > 0 && st && slip && st * slip < 0;
  if (slide > 0) {
    cling = 0.7;
    slide -= dt * (turningOut || !st ? 1.4 : 0.22);
    if (slide < 0) {
      slide = 0;
    }
    boosting = SLIDE_BOOST;
    if (st && !turningOut) {
      burstSparks(pose.x, pose.y, pose.z, vel, up, velR);
    }
  } else {
    cling = Math.max(0, cling - dt);
    boosting = cling > 0 ? SLIDE_BOOST * 0.4 : 0;
  }

  const cap = MAX_SPEED + boosting;
  if (speed > cap) {
    speed = cap;
  }
  if (speed < -MAX_REV) {
    speed = -MAX_REV;
  }

  const grip = 0.2 + 0.5 * Math.min(1, Math.abs(speed) / 16);
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
    const off = Math.abs(wrapDelta(heading - travel));
    chaseTravel(1.6 + (GRIP_FOLLOW - 1.6) * Math.max(0, 1 - off / 0.35), dt);
    slip = wrapDelta(heading - travel);
  }

  frameAt(s, moveFr);
  if (cling > 0 || turningOut) {
    travel += wrapDelta(tangentYaw(moveFr) - travel) * (1 - Math.exp(-2.6 * dt));
    slip = wrapDelta(heading - travel);
  }
  const wx = Math.sin(travel);
  const wz = Math.cos(travel);
  const tH = Math.hypot(moveFr.tx, moveFr.tz);
  const nH = Math.hypot(moveFr.nx, moveFr.nz);
  const glue = Math.abs(moveFr.ty) > 0.35 || moveFr.uy < 0.25;
  const along = tH < 0.18 || glue ? 1 : (moveFr.tx * wx + moveFr.tz * wz) / tH;
  let side = nH > 1e-4 ? (moveFr.nx * wx + moveFr.nz * wz) / nH : 0;
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
    if (cling > 0 || slide > 0 || Math.abs(slip) > 0.1) {
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

export function ghostPose(gs: number, gx: number, gh: number, out: Frame, F: number[], N: number[], Up: number[]): void {
  surface(gs, gx, 0, out);
  headingAxes(out, gh, F, N, Up);
}

export function currentLap(): number {
  return Math.min(LAPS, 1 + Math.floor(Math.max(0, dist) / trackLen));
}

export function idleTitle(): void {
  s = 6;
  x = 0.4;
  hop = 0;
  slide = 0;
  falling = 0;
  surface(s, x, 0, pose);
  heading = tangentYaw(pose) - 0.35;
  travel = heading;
  slip = 0;
  headingAxes(pose, heading, fwd, right, up);
  headingAxes(pose, travel, vel, velR, velU);
}
