// Final grade pass: this is what makes the 2D cast and the 3D sets read as ONE image.
// Vignette pulls focus to the middle, a warm/cool split-grade unifies the palette, and film grain
// sits on top of everything (grain over both layers is the cheapest way to kill the "pasted on"
// look). Grain is seeded from the frame index so every render is identical.
import React, { useEffect, useRef } from "react";

const GRAIN_SEED = 1337;

export const Grade: React.FC<{ t: number; frame: number }> = ({ frame }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const c = cv.getContext("2d");
    if (!c) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, 1080, 1920);

    // vignette
    const vg = c.createRadialGradient(540, 860, 380, 540, 960, 1180);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(0.62, "rgba(0,0,0,0.06)");
    vg.addColorStop(1, "rgba(0,0,0,0.42)");
    c.fillStyle = vg;
    c.fillRect(0, 0, 1080, 1920);

    // split grade: warm lift in the highlights, cool crush in the shadows
    c.globalCompositeOperation = "overlay";
    const sg = c.createLinearGradient(0, 0, 0, 1920);
    sg.addColorStop(0, "rgba(255,176,67,0.10)");
    sg.addColorStop(0.55, "rgba(255,255,255,0)");
    sg.addColorStop(1, "rgba(24,44,80,0.16)");
    c.fillStyle = sg;
    c.fillRect(0, 0, 1080, 1920);
    c.globalCompositeOperation = "source-over";

    // film grain, deterministic per frame
    const img = c.createImageData(1080, 1920);
    const d = img.data;
    let s = (GRAIN_SEED + frame * 2654435761) >>> 0;
    for (let i = 0; i < d.length; i += 4) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const n = ((s >>> 24) & 0xff) - 128;
      const v = 255 + n * 0.16;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 15;
    }
    c.putImageData(img, 0, 0);
  }, [frame]);
  return (
    <canvas
      ref={ref}
      width={1080}
      height={1920}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "normal" }}
    />
  );
};