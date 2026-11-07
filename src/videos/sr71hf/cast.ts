// SR-71 episode cast: same drawn characters as the High Five (toon.ts Pen engine), staged with the
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

/** stage the crew for shot `id`. Line beats: 1=ramp today, 2=mechanic vs foreman, 6=the foreman,
 *  7=the mechanic at the belly, 11=cta. Everything else is an empty (aircraft-only) shot. */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  setLight("day", cam);
  const put = (who: Who, x: number, z: number, side: boolean, fo: FrontOpts,
    so: SideOpts = { expr: fo.expr, mode: "stand", phase: fo.phase }, h = 1.8) => {
    out.places.push(person(cam, who, x, 0, z, { side, mirror: false }, fo, so));
    blob(out, x, 0, z, h / 1.8, 1);
  };
  const idle = Math.sin(t * 1.7) * 0.5 + 0.5;

  // L1: two of the ground crew on the ramp, walking past the jet
  if (id === 3 || id === 4) {
    put(MECHANIC, -3.1 + idle * 0.25, -29.6, false, FO("neutral", t * 0.9), SO("neutral", t * 0.9));
    put(FOREMAN, 0.9, -30.6, false, FO("stern", t * 0.9 + 1.2), SO("stern", t * 0.9 + 1.2));
  }

  // L2: the new mechanic vs the foreman who has seen it all
  if (id === 5 || id === 6) {
    put(MECHANIC, -2.45, -30.0, false, FO("shock", 0.2 + idle * 0.15, { look: 0.6, headTilt: -3 }));
    put(FOREMAN, -1.35, -30.4, false, FO("smile_closed", 0.2 + idle * 0.15, { look: -0.4 }));
  }

  // L6: the foreman, unbothered, hands behind his back
  if (id === 13 || id === 14) {
    put(FOREMAN, -2.45, -30.2, false, FO("stern", 0.4 + idle * 0.2, { look: -0.2 }));
    put(PILOT2, -1.35, -30.9, false, FO("neutral", 0.4 + idle * 0.2, { look: -0.7 }));
  }

  // L7: the mechanic beside the weeping belly
  if (id === 15 || id === 16) {
    put(MECHANIC, -2.8, -30.6, false, FO("pained", 0.3 + idle * 0.1, { look: 0.5, headTilt: 2 }));
  }

  // L10: close on the airframe, with the crew still in shot
  if (id === 22 || id === 23) {
    put(MECHANIC, -2.5, -30.2, false, FO("nervous", 0.3 + idle * 0.2, { look: 0.5 }));
    put(FOREMAN, -1.35, -30.6, false, FO("neutral", 0.3 + idle * 0.2, { look: 0.4 }));
  }

  // L11: CTA — both of them, waving the aircraft off
  if (id === 24 || id === 25) {
    put(MECHANIC, -2.45, -30.0, false, FO("grin", 0.2 + idle * 0.2, { wave: 0.55 + 0.45 * idle }));
    put(INSPECT, -1.35, -30.5, false, FO("grin", 0.9 + idle * 0.2, { wave: 0.55 + 0.45 * idle }));
  }

  return out;
};