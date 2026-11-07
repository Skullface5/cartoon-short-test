// SR-71 "The Leaky Bucket" — 60.8 s vertical short.
// Format: 2D-style captions over stylised low-poly 3D environments, hard cuts on the VO.
// The audio is a single premixed track (VO + synthesised SFX + free music bed) so what you hear
// is exactly the file that was verified — no per-line Audio elements to drift out of sync.
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { InkPass, noInkFallback } from "../highfive/ink";
import { LensBlur } from "../highfive/lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH } from "../highfive/grade";
import { hangarApron, rampDeck, altitudeSky, panelMacro, type Env } from "./envs";
import { Captions, wordsFromLine, type Word } from "./captions";
import { CardActor } from "./CardActor";
import { Grade } from "./Grade";
import type { ActorSpec } from "./chars";
import { LINES, TOTAL, FPS } from "./timeline";

export const SR71_FRAMES = Math.round(TOTAL * FPS);

type EnvId = "panelMacro" | "rampDeck" | "altitudeSky" | "hangarApron";
type Cam = { pos: [number, number, number]; look: [number, number, number]; fov: number };
type Shot = { t0: number; t1: number; env: EnvId; a: Cam; b: Cam };

const lerp = (x: number, y: number, k: number) => x + (y - x) * k;
const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Shot list. Cuts land on the measured VO timestamps in timeline.ts (0.6, 4.03, 9.496, 16.934,
 * 22.304, 27.626, 33.982, 39.256, 43.906, 49.3, 54.24, 57.19), subdivided so no shot runs longer
 * than ~3 s. Each shot drifts from camera A to camera B, which is what gives the slow pushes.
 */
/** Shots are defined RELATIVE TO A SPOKEN LINE, so re-recording the voice never needs a retiming
 *  pass: the cut points follow the measured speech automatically. i = line index, f = fraction of
 *  that line (0..1). */
const at = (i: number, f: number) => {
  const l = LINES[i];
  return l.start + f * (l.end - l.start);
};
const S = (i0: number, f0: number, i1: number, f1: number, env: EnvId, a: Cam, b: Cam): Shot =>
  ({ t0: at(i0, f0), t1: at(i1, f1), env, a, b });

const C = (pos: [number, number, number], look: [number, number, number], fov: number): Cam => ({ pos, look, fov });

export const SHOTS: Shot[] = [
  // L0 HOOK - macro seam, bead of fuel (seam is horizontal at y=0, 3.4 m wide; camera sits ~5 m back)
  S(0, 0,   0, 0.5, "panelMacro", C([0, 0.9, 5.6], [0, 0.05, 0], 30), C([0, 0.7, 4.6], [0, 0.05, 0], 30)),
  S(0, 0.5, 0, 1,   "panelMacro", C([0.9, 0.5, 4.8], [0, 0, 0], 31), C([0.3, 0.35, 5.8], [0, 0, 0], 33)),
  // L1 the ramp, two-man crew
  S(1, 0,   1, 0.55, "rampDeck", C([2.0, 1.75, 9.0], [0, 1.3, 3.0], 36), C([0.7, 1.65, 8.6], [0, 1.3, 3.0], 34)),
  S(1, 0.55, 1, 1,   "rampDeck", C([-1.6, 1.55, 8.4], [0, 1.3, 3.0], 36), C([-0.6, 1.55, 8.6], [0, 1.3, 3.0], 34)),
  // L2 new mechanic vs foreman
  S(2, 0,   2, 0.55, "rampDeck", C([0.3, 1.6, 7.5], [0, 1.25, 1.5], 34), C([0.5, 1.55, 7.1], [0, 1.25, 1.5], 34)),
  S(2, 0.55, 2, 1,   "rampDeck", C([0.5, 1.55, 7.1], [0, 1.25, 1.5], 34), C([0.1, 1.5, 6.9], [0, 1.25, 1.5], 34)),
  // L3 Mach 3.2 - the aircraft, medium distance so it reads as a plane
  S(3, 0,   3, 0.55, "altitudeSky", C([40, 13, -51], [10, -1, -6], 34), C([44, 12, -46], [10, -1, -6], 34)),
  S(3, 0.55, 3, 1,   "altitudeSky", C([31, 4, -29], [8, -1.2, -6], 36), C([35, 5, -25], [8, -1.2, -6], 36)),
  // L4 titanium grows
  S(4, 0,   4, 0.55, "altitudeSky", C([37, 11, -50], [9, -1, -6], 34), C([41, 10, -45], [9, -1, -6], 34)),
  S(4, 0.55, 4, 1,   "altitudeSky", C([-12, -17, -33], [10, -1, -6], 36), C([-4, -15, -28], [10, -1, -6], 34)),
  // L5 fitted tight - it tears (3 shots, longest line)
  S(5, 0,    5, 0.33, "panelMacro", C([0, 0.6, 4.4], [0, 0, 0], 32), C([0.4, 0.3, 3.4], [0, 0, 0], 32)),
  S(5, 0.33, 5, 0.66, "panelMacro", C([1.6, 0.9, 4.0], [0, 0, 0], 34), C([0.5, 0.4, 4.9], [0, 0, 0], 35)),
  S(5, 0.66, 5, 1,    "altitudeSky", C([35, 6, 27], [9, -1.2, -6], 36), C([39, 7, 32], [9, -1.2, -6], 34)),
  // L6 every seam left loose
  S(6, 0,   6, 0.55, "hangarApron", C([1.2, 1.65, 8.4], [0, 1.25, 2.4], 36), C([0.4, 1.55, 8.0], [0, 1.25, 2.4], 34)),
  S(6, 0.55, 6, 1,   "hangarApron", C([0.4, 1.55, 8.0], [0, 1.25, 2.4], 34), C([0.0, 1.5, 8.0], [0, 1.25, 2.4], 34)),
  // L7 the tanks weep
  S(7, 0,   7, 0.55, "rampDeck", C([-1.0, 1.3, 6.6], [0, 1.15, 1.4], 34), C([-0.5, 1.25, 6.4], [0, 1.15, 1.4], 34)),
  S(7, 0.55, 7, 1,   "rampDeck", C([1.6, 0.7, 4.0], [0, 0.5, 1.4], 40), C([0.8, 0.65, 3.6], [0, 0.5, 1.4], 38)),
  // L8 the match cut: drips on the ramp -> seals at altitude
  S(8, 0,   8, 0.6, "rampDeck", C([0, 1.1, 5.2], [0, 0.9, 1.4], 34), C([0, 1.05, 4.8], [0, 0.9, 1.4], 32)),
  S(8, 0.6, 8, 1,   "altitudeSky", C([32, -11, -19], [9, -1.4, -6], 36), C([27, -10, -15], [9, -1.4, -6], 34)),
  // L9 the payoff - wide reveal of the whole aircraft
  S(9, 0,    9, 0.35, "altitudeSky", C([43, 14, 118], [10, -1, -6], 38), C([46, 16, 124], [10, -1, -6], 38)),
  S(9, 0.35, 9, 0.7,  "altitudeSky", C([40, 20, 110], [10, -1, -6], 38), C([37, 18, 103], [10, -1, -6], 38)),
  S(9, 0.7,  9, 1,    "altitudeSky", C([26, 41, 83], [10, -1, -6], 34), C([29, 38, 78], [10, -1, -6], 34)),
  // L10 the kicker
  S(10, 0,   10, 0.5, "panelMacro", C([0, 1.0, 6.0], [0, 0.05, 0], 30), C([0, 0.8, 5.0], [0, 0.05, 0], 29)),
  S(10, 0.5, 10, 1,   "panelMacro", C([1.2, 0.5, 5.2], [0, 0, 0], 32), C([-0.5, 0.4, 6.0], [0, 0, 0], 33)),
  // L11 CTA
  S(11, 0,   11, 0.6, "hangarApron", C([0.9, 1.65, 7.4], [0, 1.3, 1.6], 34), C([0.3, 1.6, 7.2], [0, 1.3, 1.6], 34)),
  S(11, 0.6, 11, 1,   "hangarApron", C([0.3, 1.6, 7.2], [0, 1.3, 1.6], 34), C([0.0, 1.55, 7.0], [0, 1.3, 1.6], 33)),
];


/** Cast placed in WORLD space, so the camera moves carry them. Positions match each shot's framing. */
type Act = { t0: number; t1: number; spec: ActorSpec; pos: [number, number, number]; height?: number };
const A = (i0: number, f0: number, i1: number, f1: number): { t0: number; t1: number } =>
  ({ t0: at(i0, f0), t1: at(i1, f1) });

const ACTS: Act[] = [
  { ...A(1, 0, 1, 1), spec: { who: "crew", expr: "stern", face: 1, pose: "clamp", walk: 1 }, pos: [-0.42, 0, 3.0], height: 1.8 },
  { ...A(1, 0, 1, 1), spec: { who: "crew", expr: "neutral", face: -1, pose: "idle", walk: 1 }, pos: [0.42, 0, 3.0], height: 1.78 },
  { ...A(2, 0, 2, 1), spec: { who: "mechanic", expr: "shock", face: 1, pose: "point" }, pos: [-0.42, 0, 1.5] },
  { ...A(2, 0, 2, 1), spec: { who: "foreman", expr: "smug", face: -1, pose: "clipboard" }, pos: [0.42, 0, 1.5] },
  { ...A(6, 0, 6, 1), spec: { who: "foreman", expr: "stern", face: 1, pose: "point" }, pos: [-0.42, 0, 2.4] },
  { ...A(6, 0, 6, 1), spec: { who: "crew", expr: "awe", face: -1, pose: "lookUp" }, pos: [0.42, 0, 2.4], height: 1.75 },
  { ...A(7, 0, 8, 0.6), spec: { who: "mechanic", expr: "sad", face: 1, pose: "idle" }, pos: [0, 0, 1.4] },
  { ...A(11, 0, 11, 1), spec: { who: "mechanic", expr: "grin", face: 1, pose: "wave" }, pos: [-0.42, 0, 1.6] },
  { ...A(11, 0, 11, 1), spec: { who: "crew", expr: "grin", face: -1, pose: "wave" }, pos: [0.42, 0, 1.6], height: 1.76 },
];


/**
 * The High Five look: ink outlines on the world -> thin-lens DOF -> bloom + neutral tone map + colour
 * grade. Ink runs before the DOF so lines blur with the surface they belong to; the grade is
 * display-referred so it sits after tone mapping.
 */

/** Ink outlines as REAL geometry. The highfive InkPass is a screen-space depth/normal pass and it
 *  renders this scene black; per-mesh EdgesGeometry gives the same drawn-line look deterministically. */
const addInkEdges = (root: THREE.Object3D) => {
  const mat = new THREE.LineBasicMaterial({ color: 0x090a0d, transparent: true, opacity: 0.85, depthWrite: false });
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if ((m as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) return;
    if (m.isMesh && m.geometry) meshes.push(m);
  });
  for (const m of meshes) {
    const g = new THREE.EdgesGeometry(m.geometry as THREE.BufferGeometry, 32);
    const line = new THREE.LineSegments(g, mat);
    line.renderOrder = 1;      // draw over the surface it outlines
    m.add(line);               // child => inherits the mesh transform exactly
  }
};

const USE_INK = false, USE_LENS = true, USE_BLOOM = true, USE_GRADE = true;
const Post: React.FC<{ t: number }> = ({ t }) => {
  const { scene, camera } = useThree();
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 22, nearScale: 1.2 }),
    bloom: new BloomEffect({
      blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0,
      luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6,
    }),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.golden, GRADE_STRENGTH.golden),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);

  // focus from the SHOT data, not the live camera: the scene component sets the camera during its own
  // render, so reading camera.position here would depend on render order.
  const sh = shotAt(t);
  const kk = ease(clamp01((t - sh.t0) / Math.max(0.001, sh.t1 - sh.t0)));
  const cp = new THREE.Vector3(lerp(sh.a.pos[0], sh.b.pos[0], kk), lerp(sh.a.pos[1], sh.b.pos[1], kk), lerp(sh.a.pos[2], sh.b.pos[2], kk));
  const lk = new THREE.Vector3(lerp(sh.a.look[0], sh.b.look[0], kk), lerp(sh.a.look[1], sh.b.look[1], kk), lerp(sh.a.look[2], sh.b.look[2], kk));
  fx.lens.focus = Math.max(0.3, cp.distanceTo(lk));
  fx.lens.cInf = 30;   // deep focus: this is a graphic look, the ink does the stylising

  return (
    <EffectComposer multisampling={4}>
      {USE_INK ? <primitive object={fx.ink} dispose={null} /> : null}
      {USE_LENS ? <primitive object={fx.lens.pre} dispose={null} /> : null}
      {USE_LENS ? <primitive object={fx.lens.main} dispose={null} /> : null}
      {USE_BLOOM ? <primitive object={fx.bloom} dispose={null} /> : null}
      <primitive object={fx.tone} dispose={null} />
      {USE_GRADE ? <primitive object={fx.grade} dispose={null} /> : null}
    </EffectComposer>
  );
};

const shotAt = (t: number) => SHOTS.find((s) => t >= s.t0 && t < s.t1) ?? SHOTS[SHOTS.length - 1];

const Scene: React.FC<{ t: number }> = ({ t }) => {
  const { camera, scene } = useThree();
  const envs = useMemo<Record<EnvId, Env>>(() => ({
    panelMacro: panelMacro(), rampDeck: rampDeck(), altitudeSky: altitudeSky(), hangarApron: hangarApron(),
  }), []);
  useEffect(() => {
    Object.values(envs).forEach((e) => { noInkFallback(e.group); addInkEdges(e.group); scene.add(e.group); });
    return () => { Object.values(envs).forEach((e) => { scene.remove(e.group); e.dispose?.(); }); };
  }, [envs, scene]);

  const shot = shotAt(t);
  const k = ease(clamp01((t - shot.t0) / Math.max(0.001, shot.t1 - shot.t0)));
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(lerp(shot.a.pos[0], shot.b.pos[0], k), lerp(shot.a.pos[1], shot.b.pos[1], k), lerp(shot.a.pos[2], shot.b.pos[2], k));
  cam.lookAt(lerp(shot.a.look[0], shot.b.look[0], k), lerp(shot.a.look[1], shot.b.look[1], k), lerp(shot.a.look[2], shot.b.look[2], k));
  cam.fov = lerp(shot.a.fov, shot.b.fov, k);
  cam.updateProjectionMatrix();

  (Object.keys(envs) as EnvId[]).forEach((id) => {
    envs[id].group.visible = id === shot.env;
    if (id === shot.env) envs[id].update(t);
  });
  return <primitive object={envs[shot.env].group} dispose={null} />;
};

const WORDS: Word[] = LINES.flatMap((l) => wordsFromLine(l.text, l.start, l.end));

export const Sr71Short: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const [handle] = useState(() => delayRender("sr71"));
  const ready = useRef(false);
  useEffect(() => { if (!ready.current) { ready.current = true; continueRender(handle); } }, [handle]);
  return (
    <AbsoluteFill style={{ background: "#14161a" }}>
      <ThreeCanvas width={1080} height={1920} shadows
        gl={{ antialias: true, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 38, near: 0.05, far: 2000 }}>
        <ambientLight intensity={1.5} color="#c7d2e6" />
        <directionalLight position={[6, 12, -6]} intensity={2.2} color="#ffb043" />
        <directionalLight position={[-8, 6, 8]} intensity={0.7} color="#6f8ab5" />
        <Scene t={t} />
        {ACTS.filter((a) => t >= a.t0 && t < a.t1).map((a, i) => (
          <CardActor key={i} spec={a.spec} t={t} pos={a.pos} height={a.height} />
        ))}
        <Post t={t} />
      </ThreeCanvas>
      <Captions words={WORDS} t={t} />
      <Audio src={staticFile("sr71/audio.mp3")} />
    </AbsoluteFill>
  );
};