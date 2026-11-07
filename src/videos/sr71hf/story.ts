// Shot table for the SR-71 episode, expressed RELATIVE TO THE SPOKEN LINES so a voice change never
// needs a retiming pass (the same lesson as the previous build, applied up front).
import { LINES, TOTAL as VO_TOTAL } from "../sr71/timeline";

export const FPS = 30;
export const TOTAL = Math.ceil(VO_TOTAL * FPS);
export { LINES };

export type SceneId = "ramp" | "detail" | "top" | "sky" | "golden";
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
const DECK = C([-6, 2.2, -22], [0, 2.2, -40], 46);
const DECK2 = C([-4.5, 2.0, -23], [-1.0, 2.2, -34], 46);
const GREASE = C([-1.6, 1.55, -23.8], [-1.8, 1.25, -30], 42);
const GREASE2 = C([-3.0, 1.5, -24.2], [-2.4, 1.22, -30], 42);

// DETAIL: down at panel height, close to the airframe - the "leaky bucket" itself
const DET1 = C([-8, 0.75, -44], [4, 2.2, -48], 38);
const DET2 = C([-2, 1.1, -45], [6, 1.9, -50], 40);
const DET3 = C([2, 0.55, -46], [8, 1.6, -52], 36);

// TOP: straight down on the planform so the delta reads. The 36 m airframe needs ~90 m to fit 9:16.
const TOP1 = C([6, 95, -46], [6, 2.35, -52], 44);
const TOP2 = C([10, 80, -34], [6, 2.35, -52], 42);

// SKY: 100-130 m out on the axis PERPENDICULAR to the airframe (side-on, never head-on)
const SKY_WIDE = C([-118, 58, -20], [6, 26, -58], 46, -0.13);
const SKY_MED = C([-104, 46, -24], [6, 26, -58], 44, 0.10);
const SKY_TIGHT = C([-89, 38, -29], [6, 26, -58], 44, -0.08);
const SKY_LOW = C([-99, 6, -26], [6, 26, -58], 46, 0.12);
const SKY_BACK = C([125, 52, -95], [6, 26, -58], 46, -0.11);

export const SHOTS: Shot[] = [
  // L0 hook - the aircraft on the apron, then in to the leaking seam
  S(0, 0, 0, 0.5, "ramp", PARK_WIDE, PARK_MED),
  S(0, 0.5, 0, 1, "detail", DET1, DET2),
  // L1 the ground crew, then the planform from above
  S(1, 0, 1, 0.55, "ramp", DECK, DECK2),
  S(1, 0.55, 1, 1, "top", TOP1, TOP2),
  // L2 new mechanic vs the foreman, then the skin itself
  S(2, 0, 2, 0.55, "ramp", GREASE, GREASE2),
  S(2, 0.55, 2, 1, "detail", DET2, DET1),
  // L3 Mach 3.2 - in flight, then the planform again
  S(3, 0, 3, 0.55, "sky", SKY_MED, SKY_TIGHT),
  S(3, 0.55, 3, 1, "top", TOP2, TOP1),
  // L4 titanium grows - wide flight, then back to the crew looking up
  S(4, 0, 4, 0.55, "sky", SKY_WIDE, SKY_MED),
  S(4, 0.55, 4, 1, "ramp", GREASE2, DECK2),
  // L5 nowhere to go - detail, then the wing from below
  S(5, 0, 5, 0.5, "detail", DET1, DET3),
  S(5, 0.5, 5, 1, "ramp", GREASE, GREASE2),
  // L6 the foreman, unbothered
  S(6, 0, 6, 0.5, "ramp", GREASE2, GREASE),
  S(6, 0.5, 6, 1, "ramp", GREASE, DECK),
  // L7 the tanks weep - detail on the belly
  S(7, 0, 7, 0.55, "detail", DET3, DET2),
  S(7, 0.55, 7, 1, "ramp", GREASE2, DECK),
  // L8 the match cut: drips on the ramp -> sealed at altitude, at sunset
  S(8, 0, 8, 0.55, "ramp", DECK, PARK_MED),
  S(8, 0.55, 8, 1, "golden", SKY_LOW, SKY_MED),
  // L9 the payoff - wide golden reveal
  S(9, 0, 9, 0.4, "golden", SKY_WIDE, SKY_BACK),
  S(9, 0.4, 9, 0.75, "ramp", GREASE, DECK, "golden"),
  S(9, 0.75, 9, 1, "golden", SKY_LOW, SKY_WIDE),
  // L10 close again: apron then planform
  S(10, 0, 10, 0.5, "ramp", PARK_MED, PARK_WIDE),
  S(10, 0.5, 10, 1, "top", TOP1, TOP2),
  // L11 CTA
  S(11, 0, 11, 0.6, "ramp", DECK, GREASE),
  S(11, 0.6, 11, 1, "ramp", GREASE, GREASE2),
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