# SHOTPLAN — one-shot 5 s test (150 f @ 30 fps)

Source of truth: `templates/bridge/story.ts` (348 l), `cast.ts` (473 l), `toon.ts` (909 l).
Story: kid sits alone on a town step, head down → walker enters from the left, offers a hand →
high-five at **f60** → both walk off right → f149. No voice, no music, no captions.
Camera: slow smootherstep creep in + DOF rack street → faces, landing on f60.
Composition 1080x1920 @30fps, `fov` default 40 (three `PerspectiveCamera.fov` is **vertical**:
at 6 m the frame is only ~2.5 m wide, at 9 m ~3.7 m — that sets every distance below).

## 0. Contracts (do not edit)
- `D0` = ground contract. **Keep `D0 = 6.0`** (`D0` feeds `world.ts`: `quadUp`, `wallQuad`, deck, `PARK`).
  All framings already write `D0 + h`, so express the street as `D0` and the step top as `D0 + STEP_H`.
- `SU = 0.00216` m/unit (cast.ts): design `sole = 975` maps to card local origin → `Place.y` = foot line.
- `front()`, `marchPhase()`, `amp()`, `deckY()`, `Fz()` are the *bridge* physics; a one-shot must not call them.
- `person`, `blob`, `viewOf`, `lidAt`, `light2D` are **module-private in cast.ts** — new staging must live there.

## 1. Edits to `templates/bridge/story.ts`

1. L6 `export const TOTAL = 2025;` → `export const TOTAL = 150;`
2. L44 add the duo crowd mode:
   `export type Crowd = "march" | "fall" | "water" | "bank" | "tourists" | "none" | "duo";`
3. L46–62 replace all 15 `SHOTS` entries (ids 1–15, `a`/`b` 0…2025, `tau` `29.5+t`/`t-31`, `towns: true`) with one:
   `export const SHOTS: ShotDef[] = [{ id: 1, a: 0, b: 150, light: "day", crowd: "duo", tau: (t) => t }];`
   (omit `towns` — it would summon `townsfolkAt`, 26 waving extras.)
4. NEW scene anchors next to `PARK`/`ANCHOR` (exported, because cast.ts reads them — SKILL.md "contracts live in exported constants"):
   `export const STEP_AT: V3 = [0.4, D0, 0];` `export const STEP_H = 0.42;`
   Align `STEP_AT[2]` with the ground quad of whichever world you keep (the bridge `cobble` street sits near z ±33).
5. L64 `export const XFADE: Record<number, number> = { 9: 6, 11: 8, 12: 8, 13: 8, 14: 8, 15: 8 };`
   → `export const XFADE: Record<number, number> = {};` (`layersAt` then returns the single base layer).
6. L65 `export const FLASH_AT = 130;` → `export const FLASH_AT = -1;` (no white flash; `Bridge.tsx` stays untouched).
7. L139–196: delete every framing (`S1a…S15c`) — all of them anchor on `Fz(id, f)` / `D0 +…` bridge geometry.
   Keep the machinery above unchanged: `glide` (L99 — this *is* smootherstep `6x⁵-15x⁴+10x³`, peak 1.875×), `mix`,
   `full`, `run`, `T`, `pushK`, `dolly`, `zoom`, `rolled`.
8. L198–262 replace `CAMS: Record<number, Key[]>` (15 keys + `CAMS[10] = CAMS[9]`) with one smootherstep creep.
   `Key = { f, dur?, cut?, s }`; `run()` mixes key *i* with `glide((f - k.f)/k.dur)`, and `keys[0]` is unmixed —
   so two keys at `f: 0` (one with `dur`) make one continuous creep, then a second key at `f: 60` keeps creeping.
   The glide *is* the smootherstep, so write plain `Shot`s here and do not also wrap them in `pushK`
   (that would double-ease and, being a `dolly` toward the look point, would lift the lens as it closes):
   ```ts
   const SZ = STEP_AT[2], SX = STEP_AT[0];
   const S1a = (_f: number): Shot => ({ pos: [SX + 1.0, D0 + 1.7, SZ + 9.0], look: [SX + 0.2, D0 + 1.0, SZ], fov: 40, roll: 0 });
   const S1m = (_f: number): Shot => ({ pos: [SX + 0.6, D0 + 1.5, SZ + 5.6], look: [SX + 0.4, D0 + 1.1, SZ], fov: 38, roll: 0.035 });
   const S1b = (_f: number): Shot => ({ pos: [SX + 0.9, D0 + 1.45, SZ + 5.0], look: [SX + 0.5, D0 + 1.1, SZ], fov: 37, roll: 0.035 });
   export const CAMS: Record<number, Key[]> = { 1: [
     { f: 0, s: S1a }, { f: 0, dur: 60, s: S1m }, { f: 60, dur: 90, s: S1b } ] };
   ```
   `dur: 60` = one full smootherstep creep that **arrives on the high-five** (f60); `dur: 90` is the slower
   walk-off creep. (`full()` fills `fov`/`roll` defaults; `Shot` needs `pos` + `look` only.)
   If you want the extra sub-linear hold creep the grammar asks for, add it as `dolly(pos, look, pushK(f, f0, rate))`
   with `pushK` = `exp(-rate·frames)` — the bridge uses rates 0.0010–0.0030 (0.1–0.3 %/f); use ≤ 0.0008 here.
9. L264–266 L266 `const KICKS: [number, number][] = [[SNAP, 1], [DROP1, 1.6], [59.79, 0.5], [60.33, 0.5], [61.69, 0.7]];`
   → `const KICKS: [number, number][] = [[2.0, 0.9]];` — `camAt` calls `kickAt(T(f))`, so kicks are in **seconds**;
   frame 60 = 2.0 s. One kick = the 7-frame sign-flipping image kick + roll that lands the high-five.
   (`KICKS` is private; `kickAt` and `camAt` stay as they are.)
10. L299–321 replace the 22-entry `DOF` table with the rack. `Dof = { f, dur?, cInf, focus? }`; `dofAt` ramps
    `cInf` from the *previous* entry over `dur` but switches `focus` (a `(f)=>V3`) in one frame — so a travelling
    focus needs its own closure, and the ramp needs a preceding entry to ramp *from*:
    ```ts
    const street: V3 = [STEP_AT[0], D0 + 0.5, STEP_AT[2] - 9];          // down the street, ~14 m out
    const faces:  V3 = [STEP_AT[0] + 0.38, D0 + 1.15, STEP_AT[2]];      // between the two heads at contact
    const rackAt = (f0: number, dur: number): ((f: number) => V3) => (f) => {
      const k = glide((f - f0) / dur);
      return [street[0] + (faces[0] - street[0]) * k, street[1] + (faces[1] - street[1]) * k,
              street[2] + (faces[2] - street[2]) * k];
    };
    export const DOF: Dof[] = [
      { f: 0, cInf: 0, focus: () => street },              // wide: everything sharp
      { f: 0, dur: 60, cInf: 14, focus: rackAt(0, 60) },   // cInf 0→14 AND focus street→faces over f0–60
      { f: 60, cInf: 14, focus: () => faces },             // hold the faces through the walk-off
      { f: 120, dur: 30, cInf: 6, focus: () => faces },    // relax as they exit (optional)
    ];
    ```
    `Bridge.tsx` already converts `dofAt(f).focus` to a view-axis distance for `fx.lens.focus` and sets `cInf`.
11. L339–348 `export const FOREGROUND: Fg[] = [...cart, ...plant_bushDetailed]` → `export const FOREGROUND: Fg[] = [];`
    (its `kit` names are Kenney GLBs; the test has no `public/` assets and `world.ts` tolerates missing models only
    via `pack3`'s `.catch(() => [n,null])` — do not depend on a prop existing).
12. Leave the dead physics (`front`, `amp`, `stomp`, `dropU`, `deckY`, `shapeZ`, `ANCHOR`, `snapEnd`, `SNAP`,
    `DROP0/1`, `HALF`) **in place**: `world.ts` imports `PARK, ANCHOR, SNAP, camAt, bridgeState, deckY, dropW,
    shapeZ, snapEnd, front` (L16) and would fail to compile if they were removed. With `SHOTS[0].tau = t`,
    `bridgeState(1, t)` → `amp(t) = 0` for t ≤ 5, so the deck stays static: no edit needed.

## 2. Part B — staging the two characters (`cast.ts`)

Wire one branch into the exported dispatcher `stage(id, t, b, cam)` (L429–453) beside the existing
`column` / `sitters` / `townsfolkAt` / `tourists` / `officer` / `park` calls:
`if (s.crowd === "duo") duoStep(cam, t, out);`

`duoStep` must live **inside cast.ts** because the roles it needs are private there. Roles to call, in order:

| Role (real name) | Where | Used for |
| --- | --- | --- |
| `person(cam, who, x, y, z, view, fo, so, scale?)` | cast.ts (private, L190) | builds the `Place`: picks `bodyFront` vs `bodySide` from `view.side`, computes `tier(d)` from `cam.pos.distanceTo` and the cache key. **Never call `bodyFront`/`bodySide` directly at stage time** — `person` owns tier, mirror, key. |
| `viewOf(cam, x, z, dx, dz)` | cast.ts (private, L162) | `{side, mirror, fs}`. Walking along `+x` under a `+z` camera gives `side: true` (profile) and `mirror` = facing right. Feed `fs` into `stride`. |
| `blob(out, x, y, z, sc?, k?)` | cast.ts (private, L210) | the tight contact pool + soft day tail that keeps nobody floating. Call for both actors every frame they are on the ground (the `column`/`tourists`/`park` idiom). |
| `lidAt(t, i, swaps?)` | cast.ts (private, L175) | blink schedule (eyelid 0 open → 1 shut, 4-frame `LID = [.5,1,1,.5]`); pass `swaps` so an eyelid shuts across each expression swap. Add `SWAPS[1] = [2.0]` (the contact). |
| `light2D(cam, mirror)` | cast.ts (private, L156) | canvas key-light angle. `person` already injects it; do not pass it by hand. |
| `Outfit` constants `KID`, `PARENT` (or `townsfolk(v)`, `SKINS[v]`) | toon.ts exports (L55, L56, L66, L57) | `KID` has `build: "kid"` (shorter, bigger head) — use it for the sitter; `PARENT`/`townsfolk` for the walker. |
| `bodyFront(p, o, opts: FrontOpts)` | toon.ts export (L447) | the **front/3-4 view**: the seated kid and the face close-up of the contact. |
| `bodySide(p, o, opts: SideOpts)` | toon.ts export (L627) | the **profile walk cycle and the reaching arm**: the incoming walker and both walk-offs. |
| `fxBurst(p, t, col?, rays?, r0?, r1?)` | toon.ts export (L760) | the high-five impact card (day-coloured, e.g. `"#fff3b0"`), pushed into `out.fx` at f60 exactly as `cast.ts` L389 does for the hammer hits. |
| `Expr` (`FrontOpts.expr` / `SideOpts.expr`) | toon.ts export (L229) | face library — see the per-beat list below. |
| `mul`, `shade`, `mix`, `blobPts`, `headBlob`, `thickAngle` | toon.ts exports | only if you hand-draw a card; the two actors need none of them. |

`FrontOpts` (L435): `phase, expr, mode: "march"|"stroll"|"stand"|"sit"|"fall", look, blink, lift, prop, tilt,
headTilt, wave, light, facing, seed`. `SideOpts` (L607): `phase, expr, mode: "march"|"stand"|"swing"|"push",
blink, stomp, pose, stride, light, seed, hand`.
Not usable here: `swingKid(p, o, kick, expr, light, blink)` (toon L731) — it is the only ready-made *seated* role
but it draws the park rope + plank, so the step sitter uses `bodyFront` with `mode: "sit"` instead.

### Beat list (frame → call)
- **f0–52, kid** — the sitter, facing the street: `person(cam, {i:1,o:KID}, SX, D0 + STEP_H, SZ, {side:false,mirror:false},
  {mode:"sit", expr:"nervous", headTilt:0.28, tilt:0.04, blink:lidAt(t,1,SWAPS[1])}, {})` +
  `blob(out, SX, D0, SZ)`. `mode:"sit"` already drops `torsoBot` and folds the legs forward; the head-down read is
  `headTilt` (head rotates about the chin) + a `dazed`/`nervous` face. Keep the lens > 3.2 m away or `tier(d)`
  jumps to `[1800,3000,3.0]` canvases.
- **f0–52, walker** — in from the left at 1.6 m/s (= `stride 1`: `S = 370 * stride` units = 0.80 m, 2 steps/s):
  `const ph = q((t * 1.0) % 1, 120)` → `view = viewOf(cam, x, SZ, 1, 0)` →
  `person(cam, {i:2,o:PARENT}, x, D0, SZ, view, {mode:"march", phase:ph, expr:"smile", blink:lidAt(t,2), lift:60},
  {mode:"march", phase:ph, expr:"smile", blink:lidAt(t,2), stomp:1, stride:view.fs})` + `blob(out, x, D0, SZ)`,
  with `x = (SX - 2.35) + 1.6 * t` (arrives at `SX + 0.85` at f60, i.e. a 3.2 m walk-in).
- **f44–60, walker offers the hand** — switch that call to `mode: "push"` with a ramping `pose` and a `hand`
  target in its own canvas units, exactly as `park()` does for the parent (cast.ts L423–424, computed by
  `pushSpot`): `{mode:"push", pose:q(clamp01((t-1.4667)/0.5333),40), hand:[300 + 190, 560], expr:"grin", blink}`.
  (`hand` is read inside the lean rotation; mirror the x offset with the card's `mirror` flag.)
- **f52–60, kid takes it and high-fives** — `mode:"sit"` forces the arms into the lap, so at f52 switch the kid to
  `{mode:"stand", wave:q(clamp01((t-1.733)/0.267),30), expr:"grin", blink}` — `wave` is the front-view raised arm
  (`bodyFront` L520-522). Both cards are still front/3-4, so the raised hands read as a high-five.
- **f60, impact** — `out.fx.push({ key: `burst${q(u,30)}`, cw:500, ch:500, draw:(p)=>fxBurst(p,q(u,30)),
  x: SX + 0.38, y: D0 + 1.15, z: SZ - 0.05, w: 0.9, h: 0.9 })` for `u = (t - 2.0)/(5/FPS)` (cast.ts L387-390 copy).
  Dedicated by `KICKS = [[2.0, 0.9]]` (edit 9).
- **f60–149, both walk off right** — `view = viewOf(cam, x, SZ, 1, 0)` (now `side:true` for both) →
  `bodySide` via `person(..., {mode:"march", phase:ph, stride:view.fs, stomp:0.9, expr:"smile"|"grin"})`, with
  the kid's `Outfit` still `KID` and `x = (SX + 0.85) + 1.6 * (t - 2.0)` for both. They are side by side, so both
  clear the right edge at the same time — around f73 (at 5.6 m the frame is only ~2.3 m wide); if you want a
  staggered exit, lag the kid by 0.35 m (`x - 0.35`).
  Keep `blob(out, x, D0, SZ)` on both. `expr` swaps shut the eyelid via `SWAPS[1]`.

## 3. Verification
- `npx tsc --noEmit` (filter to the project folder) — `world.ts` L16 imports must still resolve.
- `BRIDGE_ENTRY=<entry> node scripts/bridge-stills.mjs out/x_ 0,30,60,75,120,149 0.5` and eyeball: step contact,
  the hand at f44–60, the burst at f60, both leaving at 149, `cInf` visibly growing 0→14 over f0–60.
- Export `TEMP`/`TMP` to a big drive before rendering (SKILL.md: each bundle copies `public/`, ENOSPC kills renders).
