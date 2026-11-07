// All-2D build of the SR-71 short: background world + cast + grade + captions, single medium.
// Each beat carries its own slow push/pan so shots move like camera work rather than slides.
import React, { useEffect, useRef } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { drawWorld, type WorldId } from "./world2d";
import { ActorLayer } from "./ActorLayer";
import { Grade } from "./Grade";
import { Captions, wordsFromLine, type Word } from "./captions";
import { LINES, TOTAL, FPS } from "./timeline";

export const SR71_FLAT_FRAMES = Math.round(TOTAL * FPS);

type Beat = { t0: number; t1: number; w: WorldId; z0: number; z1: number; x0: number; x1: number; y0: number; y1: number };

// Cuts land on the measured VO timestamps; 46.4 is the match cut (drip on the ramp -> sealed at altitude).
const BEATS: Beat[] = [
  { t0: 0.0,    t1: 4.03,   w: "skin",      z0: 1.00, z1: 1.10, x0: 0,    x1: 0,    y0: 0,   y1: -20 },
  { t0: 4.03,   t1: 9.496,  w: "ramp",      z0: 1.06, z1: 1.12, x0: -30,  x1: 10,   y0: 30,  y1: 0 },
  { t0: 9.496,  t1: 13.4,   w: "ramp",      z0: 1.34, z1: 1.46, x0: 60,   x1: 20,   y0: 260, y1: 210 },
  { t0: 13.4,   t1: 16.934, w: "ramp",      z0: 1.46, z1: 1.58, x0: 0,    x1: -40,  y0: 210, y1: 180 },
  { t0: 16.934, t1: 22.304, w: "alt",       z0: 1.02, z1: 1.14, x0: 0,    x1: 30,   y0: 0,   y1: -30 },
  { t0: 22.304, t1: 27.626, w: "alt",       z0: 1.14, z1: 1.26, x0: 30,   x1: -20,  y0: -30, y1: -60 },
  { t0: 27.626, t1: 33.982, w: "seamClose", z0: 1.02, z1: 1.18, x0: 0,    x1: 0,    y0: 0,   y1: -40 },
  { t0: 33.982, t1: 39.256, w: "hangar",    z0: 1.04, z1: 1.14, x0: -20,  x1: 20,   y0: 20,  y1: -10 },
  { t0: 39.256, t1: 46.4,   w: "ramp",      z0: 1.30, z1: 1.42, x0: 40,   x1: -10,  y0: 300, y1: 250 },
  { t0: 46.4,   t1: 48.85,  w: "alt",       z0: 1.30, z1: 1.40, x0: 0,    x1: 0,    y0: -140, y1: -170 },
  { t0: 48.85,  t1: 54.24,  w: "alt",       z0: 1.00, z1: 0.94, x0: 0,    x1: 0,    y0: 0,   y1: 20 },
  { t0: 54.24,  t1: 57.19,  w: "seamClose", z0: 1.10, z1: 1.20, x0: 0,    x1: 0,    y0: 20,  y1: 0 },
  { t0: 57.19,  t1: TOTAL + 0.2, w: "hangar", z0: 1.02, z1: 1.12, x0: 0,  x1: 0,    y0: 10,  y1: -10 },
];

const beatAt = (t: number) => BEATS.find((b) => t >= b.t0 && t < b.t1) ?? BEATS[BEATS.length - 1];
const smooth = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

const World: React.FC<{ t: number }> = ({ t }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const c = cv.getContext("2d");
    if (!c) return;
    const b = beatAt(t);
    const k = smooth((t - b.t0) / Math.max(0.001, b.t1 - b.t0));
    const z = b.z0 + (b.z1 - b.z0) * k;
    const ox = b.x0 + (b.x1 - b.x0) * k;
    const oy = b.y0 + (b.y1 - b.y0) * k;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, 1080, 1920);
    // scale about the frame centre, then offset = camera push/pan
    c.translate(540, 960);
    c.scale(z, z);
    c.translate(-540 + ox, -960 + oy);
    drawWorld(c, b.w, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }, [t]);
  return <canvas ref={ref} width={1080} height={1920} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
};

const WORDS: Word[] = LINES.flatMap((l) => wordsFromLine(l.text, l.start, l.end));

export const Sr71Flat: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  return (
    <AbsoluteFill style={{ background: "#0b0f16" }}>
      <World t={t} />
      <ActorLayer t={t} />
      <Grade t={t} frame={f} />
      <Captions words={WORDS} t={t} />
      <Audio src={staticFile("sr71/audio.mp3")} />
    </AbsoluteFill>
  );
};