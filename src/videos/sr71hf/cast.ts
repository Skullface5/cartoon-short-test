// SR-71 episode cast: the same drawn characters as the High Five (toon.ts Pen engine), staged with the
// template's own person()/blob() contracts so the shared character shader and contact shadows apply.
import { person, blob, setLight, type Who, type Stage, type CamInfo } from "../highfive/cast";
import { crew, type FrontOpts, type SideOpts } from "../highfive/toon";

// distinct okey per wardrobe: it is the Pool cache key, so two actors sharing one would de-dupe wrongly
const MECHANIC: Who = { i: 3, o: crew(0), okey: "sr71mech" };
const FOREMAN: Who = { i: 5, o: crew(1), okey: "sr71fore" };
const PILOT2: Who = { i: 9, o: crew(2), okey: "sr71pilot" };
const INSPECT: Who = { i: 11, o: crew(3, { helmet: "#e6e0d0" }), okey: "sr71insp" };

const FO = (expr: FrontOpts["expr"], phase = 0, extra: Partial<FrontOpts> = {}): FrontOpts =>
  ({ expr, mode: "stand", phase, ...extra });
const SO = (expr: SideOpts["expr"], phase = 0, extra: Partial<SideOpts> = {}): SideOpts =>
  ({ expr, mode: "stand", phase, ...extra });

/** Stage the crew for shot `id`. Shots 4 (planform), 6/11/15/16 (macro detail), 8, 12, 18-21 (flying)
 *  are aircraft-only inserts by design. */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  setLight("day", cam);
  const put = (who: Who, x: number, z: number, side: boolean, fo: FrontOpts,
    so: SideOpts = { expr: fo.expr, mode: "stand", phase: fo.phase }, h = 1.8) => {
    out.places.push(person(cam, who, x, 0, z, { side, mirror: false }, fo, so));
    blob(out, x, 0, z, h / 1.8, 1);
  };
  const idle = Math.sin(t * 1.7) * 0.5 + 0.5;

  // L1: the ground crew walking the ramp past the jet
  if (id === 3) {
    // profile + march cycle: a walking character reads as alive, a static one reads as a cut-out puppet
    put(MECHANIC, -3.1 + ((t * 0.55) % 1.2), -29.6, true, FO("neutral", t * 2.2),
      { expr: "neutral", mode: "march", phase: t * 2.2, stride: 1 });
    put(FOREMAN, 0.9, -30.6, true, FO("stern", t * 2.2 + 1.2),
      { expr: "stern", mode: "march", phase: t * 2.2 + 1.2, stride: 1 });
  }

  // L2: the new mechanic vs the foreman who has seen it all
  if (id === 5) {
    put(MECHANIC, -2.45, -30.0, false, FO("shock", 0.2 + idle * 0.15, { look: 0.6, headTilt: -3 }));
    put(FOREMAN, -1.35, -30.4, false, FO("smile_closed", 0.2 + idle * 0.15, { look: -0.4 }));
  }

  // L4b: cut back to the crew while the jet crosses overhead
  if (id === 10) {
    put(MECHANIC, -2.6, -30.0, false, FO("whistle", 0.3 + idle * 0.2, { look: 0.9, headTilt: -8 }));
    put(FOREMAN, -1.4, -30.4, false, FO("whistle", 0.3 + idle * 0.2, { look: 0.9, headTilt: -8 }));
  }

  // L6: the foreman, unbothered
  if (id === 13 || id === 14) {
    put(FOREMAN, -2.45, -30.2, false, FO("stern", 0.4 + idle * 0.2, { look: -0.2 }));
    put(PILOT2, -1.35, -30.9, false, FO("neutral", 0.4 + idle * 0.2, { look: -0.7 }));
  }

  // L8: back on the ramp as the drips come off it
  if (id === 17) {
    put(MECHANIC, -2.5, -30.2, false, FO("pained", 0.3 + idle * 0.15, { look: 0.5, headTilt: 2 }));
    put(FOREMAN, -1.35, -30.5, false, FO("neutral", 0.3 + idle * 0.15, { look: 0.4 }));
  }

  // L10: hands-on, close to the airframe
  if (id === 22) {
    put(MECHANIC, -2.5, -30.2, false, FO("nervous", 0.3 + idle * 0.2, { look: 0.5 }));
    put(FOREMAN, -1.35, -30.6, false, FO("neutral", 0.3 + idle * 0.2, { look: 0.4 }));
  }

  // L5b / L7b / L9b: crew beats cut into the aircraft runs
  if (id === 12 || id === 16) {
    put(MECHANIC, -2.45, -30.0, false, FO("nervous", 0.4 + idle * 0.25, { look: 0.5, headTilt: -2 }));
    put(FOREMAN, -1.35, -30.4, false, FO("stern", 0.4 + idle * 0.25, { look: -0.3 }));
  }
  if (id === 20) {
    put(MECHANIC, -2.5, -30.0, false, FO("whistle", 0.2 + idle * 0.2, { look: 0.9, headTilt: -9 }));
    put(FOREMAN, -1.35, -30.5, false, FO("whistle", 0.5 + idle * 0.2, { look: 0.9, headTilt: -9 }));
  }

  // cockpit beats: the pilot in the seat (sit pins the arms to the lap, so no gesture here)
  if (id === 8 || id === 16) {
    put(PILOT2, 0, -57.2, false, { expr: "stern", mode: "sit", phase: 0, light: -Math.PI / 2 }, undefined, 1.0);
  }

  // hangar beats: a figure out on the apron, seen through the open mouth
  if (id === 13 || id === 14) {
    put(MECHANIC, -5.5, -98, false, FO("neutral", 0.3 + idle * 0.2, { look: 0.3 }));
  }

  // L11: CTA, waving the aircraft off
  if (id === 24 || id === 25) {
    put(MECHANIC, -2.45, -30.0, false, FO("grin", 0.2 + idle * 0.2, { wave: 0.55 + 0.45 * idle }));
    put(INSPECT, -1.35, -30.5, false, FO("grin", 0.9 + idle * 0.2, { wave: 0.55 + 0.45 * idle }));
  }

  return out;
};