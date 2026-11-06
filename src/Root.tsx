import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/highfive/Bridge";
import { FPS, TOTAL } from "./videos/highfive/story";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="TestShort" component={BridgeShort} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
