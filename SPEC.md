# UniCARn — Game Spec

A js13kgames 2026 compo entry (theme: **Unicorns and Rainbows**). Total zipped package
must be **under 13,312 bytes**. On-screen title is **`UniCARn`** (exact casing — the CAR
pun must read). Relay secret name is all-caps **`UNICARN-RELAY`**.

Silent v1 — no SFX, no music, no mute control. Audio only if the zip has leftover room.

---

## 1. Development Rules

1. **Readable first, golfed later.** Terser → Roadroller → advzip/ECT via `js13k-vite-plugins`.
   Write clear TypeScript. Hyper-golf only once the game is mature.
2. **Efficient, not clever.** Plain modules, const enums as numbers, flat state. No classes
   that do not pay for themselves.
3. **Repetition compresses well.** Prefer consistent patterns over clever DRY.
4. **One recipe, derived variants.** Geometry is authored in code (boxes, pyramids, strips).
   Per-draw colors, not textures.
5. **Measure, don't guess.** Run `npm run build` and track [`SIZE_LOG.md`](SIZE_LOG.md).
6. **No runtime npm deps.** Hand-rolled or vendored. No three.js.
7. **TypeScript strictness stays on.**
8. **Dev tooling** lives in `src/debug.ts` and loads only behind `import.meta.env.DEV`.
9. **Director's Cut.** Cut features go under `src/directors-cut/` and stay out of the
   production entry. Do not delete them.
10. **Starter archive.** The original js13k-starter platformer lives in `src/_demo/` and
    is excluded from `tsconfig` / the zip. Do not import it from production.

All timing is **real time** (seconds/milliseconds), never frames.

**Fallback ladder** if over the cap (cheapest pain first):

1. Stars / clouds
2. Mane and tail
3. Reverse
4. 3-2-1 countdown
5. Extra checkpoints (keep start/finish + one mid)
6. Shared ghost (keep local PB ghost)
7. Second loop

Audio is already out of v1.

---

## 2. Game Overview

### Premise

You drive a **UniCARn** — a unicorn with tires instead of legs — on a concave rainbow
circuit. Two laps. Beat the clock. Race the **ghost of the best run** the world has
shared (or your own best, offline).

### Structure

- **Genre:** 3D kart time trial (Mario Kart / Rainbow Road *feel*, not physics).
- **Track:** one hand-authored **closed** ribbon. Concave U-trough. Hills. Loops.
  More complex than Rainbow Run's flat endless arcs.
- **A run:** 3-2-1-GO, then **2 laps**. Target a good finish near **~60 seconds**.
- **Win:** beat your best time. Online, also try to become the global #1 ghost.
- **Fail:** fall off the lip → short drop → last checkpoint → **+2.0s**. Loops fail
  **only** by going off the sides. Stay on the ribbon and you complete the loop even slowly.
  The camera follows the track's up, so loops invert the view.

### Title screen and flow

- Title **`UniCARn`** in rainbow letters (7 letters / 7 colors).
- Username field (default random 8-char hex id, max 13). **START**, **HIGH SCORES**.
- 3D UniCARn idles on the start line behind the menu.
- **Full loop:** title → Start → countdown → race → finish overlay → title.
  Pause: **Resume** / **Quit to Menu** (quit does not publish).

### Controls

Keyboard only for v1 (Desktop + Online). Chrome and Firefox.

| Action | Keys |
|--------|------|
| Accelerate | ↑ or W |
| Brake / reverse | ↓ or S |
| Steer | ← → or A D |
| Hop | **Space** |
| Power-slide | steer **while** hopping |
| Pause | P or Escape |
| Menu | arrows + Enter / click |

Hop + steer puts the UniCARn into a **power-slide**: rainbow sparks from the rear and a
speed boost. Slide lasts a short time after landing.

### Surface contract (not physics)

Player state lives on the unwrapped ribbon: `s` (arc length), `x` (lateral), `heading`
(yaw relative to the tangent), `speed`, hop along the surface normal.

While on the trough you are **glued** to it — including through loops. World position is
the path frame plus a concave cross-section. Off the lip → leave the ribbon, fall in
world space, respawn at the last gate.

### Best run / Online

- Record the run as compact samples `{dist, x, heading}` (~6–8 Hz).
- **Ghost:** replay the global #1 on the track. If the board is empty or you are offline,
  replay the **local PB**. If neither exists, the track is empty.
- Gossip over `wss://relay.js13kgames.com/unicarn` (same pattern as Rainbow Run).
  - `r`: top times `[id, name, timeMs, ts]` — **lower time wins**
  - `g`: **only the #1** packed replay
- Name **`UNICARN-RELAY`** pulses the board and never writes a score.
- Seeder: `tools/ladder-seed.mjs` (`npm run seed`).
- Game never blocks on the network.

### Persistence

`localStorage` key **`uc26`**: `{v, i, n, b, g}` — id, name, best time ms, packed local ghost.
Ladder cache **`uc26L`**.

### Out of v1

Audio, shop, items, boost pads, mobile stick, live multiplayer, real loop gravity,
multiple shared ghosts.

---

## 3. Technical Design

### Rendering

Raw **WebGL1**, unlit, flat color. Dual canvas: `#c` WebGL, `#u` 2D overlay (`fillText`,
system font `"Segoe UI", system-ui, sans-serif`). No letterbox. DPR-capped resize.

### Path

Hand-authored commands (straight, yaw-arc, pitch bump, stretched vertical loop) sampled
into a closed polyline of frames `(P, T, N, U)`. Query by arc-length. Loop: pitch 2π in
the local vertical plane plus a small forward offset so entrance ≠ exit.

Road: 7 ROYGBIV bands on a concave trough (`y = k (x/half)^2`). Fall when `|x|` exceeds
the lip.

### Models

Shared unit box + pyramid. UniCARn kit: body, neck, long head, horn, mane, tail, **four
tires** (spin with speed). Ghost draws the same mesh at lower alpha.

### Camera

Chase cam from `-forward * back + up * height`, look along the tangent, **up = track U**
so loops invert the horizon.

---

## 4. Palette

Same rainbow hexes as Dye Hard / Rainbow Run:

| Color  | Hex      |
|--------|----------|
| Red    | `e40404` |
| Orange | `ff8200` |
| Yellow | `f1e300` |
| Green  | `08ba00` |
| Blue   | `0030e2` |
| Indigo | `6c00ef` |
| Violet | `a656ff` |

Body: off-white. Tires: dark grey. Horn: pale gold. Sky: dark purple.

---

## 5. Tune in play

Speed, accel, brake, steer, hop, slide boost / duration, trough concavity, lip width,
checkpoint penalty (start **2.0s**), camera, lap length (~60s / 2 laps), ghost sample rate.

---

## 6. Build order

| Phase | Work | Complete |
|-------|------|----------|
| 0 | SPEC + archive starter + WebGL husk | ✅ |
| 1 | Closed flat circuit + kart + title START | ✅ |
| 2 | UniCARn mesh + 7-band road | ✅ |
| 3 | Hop / slide / sparks | ✅ |
| 4 | Concavity, loops, fall/respawn, 2-lap timer | ✅ |
| 5 | Ghost + Online + `UNICARN-RELAY` | ✅ |
| 6 | Tune ~60s, SIZE_LOG, golf, submit | in play |
