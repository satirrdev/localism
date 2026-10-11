import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Scene1Problem } from "./scenes/Scene1Problem";
import { Scene2Solution } from "./scenes/Scene2Solution";
import { Scene3Proof } from "./scenes/Scene3Proof";
import { Scene4Outro } from "./scenes/Scene4Outro";

export const LaunchVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0C" }}>
      {/* Scene 1: The Problem (Frames 0 - 90 / 0-3s) */}
      <Sequence from={0} durationInFrames={90}>
        <Scene1Problem />
      </Sequence>

      {/* Scene 2: The Solution & UI Preview (Frames 80 - 210 / ~3-7s) */}
      <Sequence from={80} durationInFrames={130}>
        <Scene2Solution />
      </Sequence>

      {/* Scene 3: The Proof (Frames 200 - 290 / ~7-10s) */}
      <Sequence from={200} durationInFrames={90}>
        <Scene3Proof />
      </Sequence>

      {/* Scene 4: Outro & Call to Action (Frames 280 - 360 / ~10-12s) */}
      <Sequence from={280} durationInFrames={80}>
        <Scene4Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
