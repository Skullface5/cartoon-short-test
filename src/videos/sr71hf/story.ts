// Shot table for the SR-71 episode, expressed RELATIVE TO THE SPOKEN LINES so a voice change never
// needs a retiming pass (the same lesson as the previous build, applied up front).
import { LINES, TOTAL as VO_TOTAL } from "../sr71/timeline";

export const FPS = 30;
export const TOTAL = Math.ceil(VO_TOTAL * FPS);
export { LINES };

export type SceneId = "ramp" | "sky";
export type Light = "day" | "golden";
export type Cam = { pos: [number, number, number]; look: [number, number, number]; fov: number; roll?: number };

export type Shot = { id: number; a: number; b: number; scene: SceneId; light: Light; ca: Cam; cb: Cam };

const at = (i: number, f: number) => {
  const l = LINES[i];
  return Math.round((l.start + f * (l.end - l.start)) * FPS);
};

/** one shot: line i0 at fraction f0 -> line i1 at fraction f1 */
const S = (i0: number, f0: number, i1: number, f1: number, scene: SceneId, ca: Cam, cb: Cam, light: Light = "day"): Shot => {
  const a = at(i0, f0), b = Math.max(at(i1, f1), a + 2);
  return { id: 0, a, b, scene, light, ca, cb };
};

const C = (pos: [number, number, number], look: [number, number, number], fov: number, roll = 0): Cam => ({ pos, look, fov, roll });

// the parked aircraft sits at (4, 2.35, -34) yaw -0.42; the crew work around (-1.5..1.8, 0, -24)
const PARK_WIDE = C([-8, 10, 6], [6, 5, -52], 46);
const PARK_MED = C([-2, 6.5, -10], [6, 4.6, -52], 44);
const GREASE = C([-1.6, 1.55, -23.8], [-1.8, 1.25, -30], 42);
const GREASE_2 = C([-3.0, 1.5, -24.2], [-2.4, 1.22, -30], 42);
const BELLY = C([-14, 1.9, -31], [6, 3.4, -48], 44);
const BELLY2 = C([-17, 2.3, -28], [6, 3.6, -48], 42);
const DECK = C([-6, 2.2, -22], [0, 2.2, -40], 46);
// Flying shots: the aircraft is ~30 m long and 27 m across, and a 9:16 frame's HORIZONTAL half-angle
// is only atan(tan(fov/2)*9/16) ~ 12.8 deg, so it needs ~90 m to fit. These sit on the AXIS
// PERPENDICULAR to the aircraft's long axis, so it is always seen side-on, never head-on.
// The aircraft is 36 m tip to tail (nose cone -17.6 to tail cone +18.45) and 27 m across. A 9:16 frame's
// horizontal half-angle is only atan(tan(fov/2)*9/16) ~ 13 deg, so fitting it needs
// d >= 18/ (tan(fov/2)*9/16) * 1.15 ~ 100 m. Measured at 90 m it still spanned 100% of the frame width.
// All flying cameras sit 100-130 m out, on the axis PERPENDICULAR to the airframe (side-on, never head-on).
const SKY_WIDE = C([-118, 58, -20], [6, 26, -58], 46);
const SKY_MED = C([-104, 46, -24], [6, 26, -58], 44);
const SKY_TIGHT = C([-89, 38, -29], [6, 26, -58], 44);
const SKY_LOW = C([-99, 6, -26], [6, 26, -58], 46);
const SKY_BACK = C([125, 52, -95], [6, 26, -58], 46);

export const SHOTS: Shot[] = [
  // L0 hook: the aircraft on the apron, leaking
  S(0, 0, 0, 0.5, "ramp", PARK_WIDE, PARK_MED),
  S(0, 0.5, 0, 1, "ramp", PARK_MED, C([2, 5.2, -22], [6, 4.4, -52], 44)),
  // L1 the crew on the ramp
  S(1, 0, 1, 0.55, "ramp", DECK, C([-4.5, 2.0, -23], [-1.0, 2.2, -34], 46)),
  S(1, 0.55, 1, 1, "ramp", C([-3.5, 1.9, -23.4], [-0.5, 2.0, -34], 44), DECK),
  // L2 new mechanic vs foreman
  S(2, 0, 2, 0.55, "ramp", GREASE, GREASE_2),
  S(2, 0.55, 2, 1, "ramp", GREASE_2, C([-2.6, 1.45, -24.4], [-2.0, 1.2, -30], 41)),
  // L3 + L4 the aircraft in flight
  S(3, 0, 3, 0.55, "sky", SKY_MED, SKY_TIGHT),
  S(3, 0.55, 3, 1, "sky", SKY_TIGHT, SKY_MED),
  S(4, 0, 4, 0.55, "sky", SKY_WIDE, SKY_MED),
  S(4, 0.55, 4, 1, "ramp", C([-3.0, 1.55, -24.2], [-2.4, 1.22, -30], 44), C([-5.0, 3.4, -22], [-1.0, 6.0, -40], 46)),
  // L5 the skin has nowhere to go
  S(5, 0, 5, 0.5, "sky", SKY_TIGHT, C([-89, 34, -30], [6, 26, -58], 42)),
  S(5, 0.5, 5, 1, "sky", C([-89, 34, -30], [6, 26, -58], 42), SKY_LOW),
  // L6 the foreman, unbothered
  S(6, 0, 6, 0.5, "ramp", GREASE_2, GREASE),
  S(6, 0.5, 6, 1, "ramp", GREASE, C([-3.2, 1.55, -24.6], [-2.6, 1.28, -30], 40)),
  // L7 the tanks weep
  S(7, 0, 7, 0.55, "ramp", BELLY, BELLY2),
  S(7, 0.55, 7, 1, "ramp", BELLY2, BELLY),
  // L8 the match cut: drips on the ramp -> sealed at altitude
  S(8, 0, 8, 0.55, "ramp", DECK, PARK_MED),
  S(8, 0.55, 8, 1, "sky", SKY_LOW, SKY_MED),
  // L9 the payoff: wide reveal
  S(9, 0, 9, 0.4, "sky", SKY_WIDE, SKY_BACK),
  S(9, 0.4, 9, 0.75, "sky", SKY_BACK, SKY_LOW),
  S(9, 0.75, 9, 1, "sky", SKY_LOW, SKY_WIDE),
  // L10 close on the airframe
  S(10, 0, 10, 0.5, "ramp", PARK_MED, PARK_WIDE),
  S(10, 0.5, 10, 1, "ramp", PARK_WIDE, PARK_MED),
  // L11 CTA
  S(11, 0, 11, 0.6, "ramp", DECK, GREASE),
  S(11, 0.6, 11, 1, "ramp", GREASE, DECK),
].map((s, i) => ({ ...s, id: i + 1 }));

export const lightOf = (id: number): Light => SHOTS[id - 1]?.light ?? "day";
export const sceneOf = (id: number): SceneId => SHOTS[id - 1]?.scene ?? "ramp";

const smooth = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1] ?? SHOTS[0];
  const k = smooth((f - s.a) / Math.max(1, s.b - s.a));
  return {
    pos: [lerp(s.ca.pos[0], s.cb.pos[0], k), lerp(s.ca.pos[1], s.cb.pos[1], k), lerp(s.ca.pos[2], s.cb.pos[2], k)],
    look: [lerp(s.ca.look[0], s.cb.look[0], k), lerp(s.ca.look[1], s.cb.look[1], k), lerp(s.ca.look[2], s.cb.look[2], k)],
    fov: lerp(s.ca.fov, s.cb.fov, k),
    roll: lerp(s.ca.roll ?? 0, s.cb.roll ?? 0, k),
  };
};

/** shots that own the frame at f (crossfade over 8 frames at a cut) */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  const i = SHOTS.findIndex((s) => f >= s.a && f < s.b);
  if (i < 0) return [{ id: SHOTS[SHOTS.length - 1].id, alpha: 1 }];
  const s = SHOTS[i], cut = 8;
  if (i > 0 && f < s.a + cut) return [{ id: SHOTS[i - 1].id, alpha: 1 }, { id: s.id, alpha: (f - s.a) / cut }];
  return [{ id: s.id, alpha: 1 }];
};

/** thin-lens far-CoC per shot: shallow on the close character beats, deep on the flying wides */
export const dofAt = (f: number): { cInf: number } => {
  const i = SHOTS.findIndex((s) => f >= s.a && f < s.b);
  if (i < 0) return { cInf: 12 };
  const s = SHOTS[i];
  const ramp = s.scene === "ramp";
  const wide = s.ca.pos[0] * s.ca.pos[0] + s.ca.pos[2] * s.ca.pos[2] > 400;
  return { cInf: ramp ? (wide ? 20 : 14) : 26 };
};