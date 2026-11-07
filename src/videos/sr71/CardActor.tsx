// A cast member rendered INTO the 3D scene as a billboard card.
// Drawing them to a texture on a plane (rather than a screen-space overlay) is what makes the
// camera moves actually move them - screen-space actors sit still while the world slides, which
// reads as flat no matter how good the art is.
import React, { useMemo } from "react";
import * as THREE from "three";
import { drawActor, type ActorSpec } from "./chars";

const CW = 512, CH = 1024;   // card canvas; the figure occupies roughly the middle-bottom of it

export const CardActor: React.FC<{
  spec: ActorSpec;
  t: number;
  pos: [number, number, number];
  /** standing height in metres */
  height?: number;
}> = ({ spec, t, pos, height = 1.8 }) => {
  const { canvas, tex } = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = CW; cv.height = CH;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return { canvas: cv, tex };
  }, []);

  // Draw during RENDER, not in a useEffect: Remotion captures the frame after React renders, so an
  // effect-populated texture is still empty at capture time and the actor silently vanishes.
  const c = canvas.getContext("2d");
  if (c) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, CW, CH);
    // feet near the bottom of the card, so the plane's base lines up with the ground
    drawActor(c, { ...spec, x: 0.5, y: 0.94, h: 0.82 }, t, CW, CH);
    tex.needsUpdate = true;
  }

  // card is 0.5 aspect; scale so the FIGURE is `height` metres tall (figure fills ~0.82 of the card)
  const planeH = height / 0.82;
  const planeW = planeH * (CW / CH);

  return (
    <mesh position={[pos[0], pos[1] + planeH * 0.47, pos[2]]} renderOrder={2}>
      <planeGeometry args={[planeW, planeH]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.02} depthWrite={false} toneMapped={false} />
    </mesh>
  );
};
