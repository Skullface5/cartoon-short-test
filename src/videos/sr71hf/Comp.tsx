// "The Leaky Bucket" — SR-71 episode built in the High Five system: same InkPass -> lens/DOF ->
// bloom + NEUTRAL tone map + grade chain, same toon cast, same two-tone world materials.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World } from "./world";
import { InkPass, noInkFallback } from "../highfive/ink";
import { LensBlur } from "../highfive/lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "../highfive/grade";
import { SHOTS, TOTAL, FPS, dofAt, lightOf, LINES } from "./story";
import { Captions, wordsFromLine, type Word } from "../sr71/captions";

export const SR71HF_FRAMES = TOTAL;
const WORDS: Word[] = LINES.flatMap((l) => wordsFromLine(l.text, l.start, l.end));

type Tog = { ink: boolean; lens: boolean; bloom: boolean; grade: boolean };
const toggles = (): Tog => ({ ink: true, lens: true, bloom: true, grade: true, ...((getInputProps() as { post?: Partial<Tog> }).post ?? {}) });

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass, setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const Inner: React.FC<{ id: number }> = ({ id }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(), []);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 12, nearScale: 1.2 }),    // 24 was tuned for tight character framings; on wides it turned the frame to mush,
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);


  const cam = camera as THREE.PerspectiveCamera;
  const target = world.update(id, f, cam, scene);
  noInkFallback(world.root);
  const fwd = new THREE.Vector3();
  cam.getWorldDirection(fwd);
  fx.lens.focus = Math.max(0.3, target.clone().sub(cam.position).dot(fwd));
  fx.lens.cInf = dofAt(f).cInf;
  gradeFor(fx.grade, lightOf(id));

  return (
    <>
      <primitive object={world.root} dispose={null} />
      <EffectComposer multisampling={4}>
        {on.ink ? <primitive object={fx.ink} dispose={null} /> : null}
        {on.lens ? <primitive object={fx.lens.pre} dispose={null} /> : null}
        {on.lens ? <primitive object={fx.lens.main} dispose={null} /> : null}
        {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : null}
        <primitive object={fx.tone} dispose={null} />
        {on.grade ? <primitive object={fx.grade} dispose={null} /> : null}
      </EffectComposer>
    </>
  );
};

export const Sr71HF: React.FC = () => {
  const f = useCurrentFrame();
  const shot = SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
  const t = f / FPS;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      <ThreeCanvas width={1080} height={1920} shadows
        gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.2, far: 1800 }}>
        <Inner id={shot.id} />
      </ThreeCanvas>
      <Captions words={WORDS} t={t} />
      <Audio src={staticFile("sr71/audio.mp3")} />
    </AbsoluteFill>
  );
};