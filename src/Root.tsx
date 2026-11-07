import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/highfive/Bridge";
import { FPS, TOTAL } from "./videos/highfive/story";
import { Sr71Short, SR71_FRAMES } from "./videos/sr71/Sr71";
import { Sr71Flat, SR71_FLAT_FRAMES } from "./videos/sr71/Sr71Flat";
import { Sr71HF, SR71HF_FRAMES } from "./videos/sr71hf/Comp";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="TestShort" component={BridgeShort} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="Sr71Short" component={Sr71Short} durationInFrames={SR71_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Sr71Flat" component={Sr71Flat} durationInFrames={SR71_FLAT_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Sr71HF" component={Sr71HF} durationInFrames={SR71HF_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
