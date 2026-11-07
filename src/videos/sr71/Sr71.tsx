// SR-71 "The Leaky Bucket" — 60.8 s vertical short.
// Format: 2D-style captions over stylised low-poly 3D environments, hard cuts on the VO.
// The audio is a single premixed track (VO + synthesised SFX + free music bed) so what you hear
// is exactly the file that was verified — no per-line Audio elements to drift out of sync.
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
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
const S = (t0: number, t1: number, env: EnvId, a: Cam, b: Cam): Shot => ({ t0, t1, env, a, b });

export const SHOTS: Shot[] = [
  // L0 (0.55) HOOK - macro seam, bead of fuel
  S(0.0, 2.4, "panelMacro", { pos: [0, 1.0, 3.2], look: [0, 1.0, 0], fov: 30 }, { pos: [0, 1.0, 2.4], look: [0, 1.0, 0], fov: 28 }),
  S(2.4, 4.331, "panelMacro", { pos: [0.5, 1.15, 2.6], look: [0, 1.0, 0], fov: 30 }, { pos: [0.2, 1.05, 3.4], look: [0, 1.0, 0], fov: 34 }),
  // L1 (4.331) the ramp, crew
  S(4.331, 8.0, "rampDeck", { pos: [2.0, 1.75, 9.0], look: [0, 1.3, 3.0], fov: 36 }, { pos: [0.7, 1.65, 8.6], look: [0, 1.3, 3.0], fov: 34 }),
  S(8.0, 11.502, "rampDeck", { pos: [-1.6, 1.55, 8.4], look: [0, 1.3, 3.0], fov: 36 }, { pos: [-0.6, 1.55, 8.6], look: [0, 1.3, 3.0], fov: 34 }),
  // L2 (11.502) new mechanic vs foreman
  S(11.502, 15.0, "rampDeck", { pos: [0.3, 1.6, 7.5], look: [0, 1.25, 1.5], fov: 34 }, { pos: [0.5, 1.55, 7.1], look: [0, 1.25, 1.5], fov: 34 }),
  S(15.0, 18.643, "rampDeck", { pos: [0.5, 1.55, 7.1], look: [0, 1.25, 1.5], fov: 34 }, { pos: [0.1, 1.5, 6.9], look: [0, 1.25, 1.5], fov: 34 }),
  // L3 (18.643) Mach 3.2
  S(18.643, 21.7, "altitudeSky", { pos: [0, 1.2, 6.0], look: [0, 1.0, 0], fov: 40 }, { pos: [0, 1.15, 4.2], look: [0, 1.0, 0], fov: 38 }),
  S(21.7, 24.774, "altitudeSky", { pos: [1.6, 1.1, 5.0], look: [0, 1.0, 0], fov: 42 }, { pos: [2.6, 1.05, 6.2], look: [0, 1.0, 0], fov: 40 }),
  // L4 (24.774) titanium grows
  S(24.774, 27.7, "altitudeSky", { pos: [0, 1.0, 7.5], look: [0, 1.0, 0], fov: 36 }, { pos: [0, 1.0, 5.6], look: [0, 1.0, 0], fov: 34 }),
  S(27.7, 30.705, "altitudeSky", { pos: [-1.0, 1.1, 5.2], look: [0, 1.0, 0], fov: 38 }, { pos: [-1.8, 1.05, 4.4], look: [0, 1.0, 0], fov: 36 }),
  // L5 (30.705, 10.2s) fitted tight - it tears: three shots so it never sits still
  S(30.705, 34.3, "panelMacro", { pos: [0, 1.1, 2.2], look: [0, 1.0, 0], fov: 32 }, { pos: [0, 1.05, 1.5], look: [0, 1.0, 0], fov: 30 }),
  S(34.3, 37.8, "panelMacro", { pos: [0.8, 1.3, 1.6], look: [0, 1.0, 0], fov: 34 }, { pos: [0.3, 1.1, 2.4], look: [0, 1.0, 0], fov: 36 }),
  S(37.8, 41.406, "altitudeSky", { pos: [0.5, 1.15, 4.6], look: [0, 1.0, 0], fov: 36 }, { pos: [-0.5, 1.05, 5.6], look: [0, 1.0, 0], fov: 38 }),
  // L6 (41.406) every seam left loose
  S(41.406, 43.8, "hangarApron", { pos: [1.2, 1.65, 8.4], look: [0, 1.25, 2.4], fov: 36 }, { pos: [0.4, 1.55, 8.0], look: [0, 1.25, 2.4], fov: 34 }),
  S(43.8, 46.195, "hangarApron", { pos: [0.4, 1.55, 8.0], look: [0, 1.25, 2.4], fov: 34 }, { pos: [0.0, 1.5, 8.0], look: [0, 1.25, 2.4], fov: 34 }),
  // L7 (46.195) the tanks weep
  S(46.195, 48.9, "rampDeck", { pos: [-1.0, 1.3, 6.6], look: [0, 1.15, 1.4], fov: 34 }, { pos: [-0.5, 1.25, 6.4], look: [0, 1.15, 1.4], fov: 34 }),
  S(48.9, 51.646, "rampDeck", { pos: [1.6, 0.7, 4.0], look: [0, 0.5, 1.4], fov: 40 }, { pos: [0.8, 0.65, 3.6], look: [0, 0.5, 1.4], fov: 38 }),
  // L8 (51.646) the match cut
  S(51.646, 54.9, "rampDeck", { pos: [0, 1.1, 5.2], look: [0, 0.9, 1.4], fov: 34 }, { pos: [0, 1.05, 4.8], look: [0, 0.9, 1.4], fov: 32 }),
  S(54.9, 58.337, "altitudeSky", { pos: [0, 1.1, 5.2], look: [0, 0.9, 1.4], fov: 34 }, { pos: [0, 1.05, 4.8], look: [0, 0.9, 1.4], fov: 32 }),
  // L9 (58.337, 8.6s) the payoff
  S(58.337, 61.3, "altitudeSky", { pos: [0, 1.6, 9.0], look: [0, 1.3, 0], fov: 38 }, { pos: [0, 1.8, 12.0], look: [0, 1.3, 0], fov: 36 }),
  S(61.3, 64.3, "altitudeSky", { pos: [0, 2.0, 15.0], look: [0, 1.4, 0], fov: 34 }, { pos: [0, 2.2, 19.0], look: [0, 1.5, 0], fov: 32 }),
  S(64.3, 67.376, "altitudeSky", { pos: [-1.2, 2.1, 17.0], look: [0, 1.45, 0], fov: 34 }, { pos: [1.0, 2.1, 15.5], look: [0, 1.45, 0], fov: 33 }),
  // L10 (67.376) the kicker
  S(67.376, 70.4, "panelMacro", { pos: [0, 1.0, 3.0], look: [0, 1.0, 0], fov: 30 }, { pos: [0, 1.0, 2.5], look: [0, 1.0, 0], fov: 29 }),
  S(70.4, 73.427, "panelMacro", { pos: [0.6, 1.1, 2.2], look: [0, 1.0, 0], fov: 32 }, { pos: [-0.3, 1.05, 2.8], look: [0, 1.0, 0], fov: 33 }),
  // L11 (73.427) CTA
  S(73.427, 75.7, "hangarApron", { pos: [0.9, 1.65, 7.4], look: [0, 1.3, 1.6], fov: 34 }, { pos: [0.3, 1.6, 7.2], look: [0, 1.3, 1.6], fov: 34 }),
  S(75.7, TOTAL + 0.1, "hangarApron", { pos: [0.3, 1.6, 7.2], look: [0, 1.3, 1.6], fov: 34 }, { pos: [0.0, 1.55, 7.0], look: [0, 1.3, 1.6], fov: 33 }),
];


/** Cast placed in WORLD space, so the camera moves carry them. Positions match each shot's framing. */
type Act = { t0: number; t1: number; spec: ActorSpec; pos: [number, number, number]; height?: number };
const ACTS: Act[] = [
  { t0: 4.331, t1: 11.502, spec: { who: "crew", expr: "stern", face: 1, pose: "clamp", walk: 1 }, pos: [-0.42, 0, 3.0], height: 1.8 },
  { t0: 4.331, t1: 11.502, spec: { who: "crew", expr: "neutral", face: -1, pose: "idle", walk: 1 }, pos: [0.42, 0, 3.0], height: 1.78 },
  { t0: 11.502, t1: 18.643, spec: { who: "mechanic", expr: "shock", face: 1, pose: "point" }, pos: [-0.42, 0, 1.5] },
  { t0: 11.502, t1: 18.643, spec: { who: "foreman", expr: "smug", face: -1, pose: "clipboard" }, pos: [0.42, 0, 1.5] },
  { t0: 41.406, t1: 46.195, spec: { who: "foreman", expr: "stern", face: 1, pose: "point" }, pos: [-0.42, 0, 2.4] },
  { t0: 41.406, t1: 46.195, spec: { who: "crew", expr: "awe", face: -1, pose: "lookUp" }, pos: [0.42, 0, 2.4], height: 1.75 },
  { t0: 46.195, t1: 54.9, spec: { who: "mechanic", expr: "sad", face: 1, pose: "idle" }, pos: [0, 0, 1.4] },
  { t0: 73.427, t1: TOTAL + 0.2, spec: { who: "mechanic", expr: "grin", face: 1, pose: "wave" }, pos: [-0.42, 0, 1.6] },
  { t0: 73.427, t1: TOTAL + 0.2, spec: { who: "crew", expr: "grin", face: -1, pose: "wave" }, pos: [0.42, 0, 1.6], height: 1.76 },
];

const shotAt = (t: number) => SHOTS.find((s) => t >= s.t0 && t < s.t1) ?? SHOTS[SHOTS.length - 1];

const Scene: React.FC<{ t: number }> = ({ t }) => {
  const { camera, scene } = useThree();
  const envs = useMemo<Record<EnvId, Env>>(() => ({
    panelMacro: panelMacro(), rampDeck: rampDeck(), altitudeSky: altitudeSky(), hangarApron: hangarApron(),
  }), []);
  useEffect(() => {
    Object.values(envs).forEach((e) => scene.add(e.group));
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
      </ThreeCanvas>
      <Grade t={t} frame={f} />
      <Captions words={WORDS} t={t} />
      <Audio src={staticFile("sr71/audio.mp3")} />
    </AbsoluteFill>
  );
};