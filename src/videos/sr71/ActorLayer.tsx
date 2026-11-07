// Canvas overlay that draws the 2D cast on top of the 3D set, under the captions.
import React, { useEffect, useRef } from "react";
import { actorsAt, drawActor } from "./chars";

export const ActorLayer: React.FC<{ t: number }> = ({ t }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const c = cv.getContext("2d");
    if (!c) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, 1080, 1920);
    for (const a of actorsAt(t)) drawActor(c, a, t);
  }, [t]);
  return (
    <canvas
      ref={ref}
      width={1080}
      height={1920}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
};