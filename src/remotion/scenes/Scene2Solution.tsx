import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrowserMockup } from "../components/BrowserMockup";

export const Scene2Solution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring for browser mockup
  const entranceSpring = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 80, mass: 1.1 },
  });

  // Floating badge spring entrance
  const badgeSpring = spring({
    frame: frame - 25,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  // Subtle breathing float for the 3D tilt
  const tiltX = 4 + Math.sin(frame / 20) * 1.5;
  const tiltY = -3 + Math.cos(frame / 25) * 1.5;

  // Scale and translate calculated from entrance spring
  const scale = interpolate(entranceSpring, [0, 1], [0.82, 0.98]);
  const translateY = interpolate(entranceSpring, [0, 1], [80, 20]);
  const opacity = interpolate(entranceSpring, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Exit transition towards scene 3 (frames 115-130)
  const exitProgress = interpolate(frame, [115, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0A0A0C",
        justifyContent: "center",
        alignItems: "center",
        opacity: opacity * (1 - exitProgress * 0.4),
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Geist Sans", sans-serif',
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          width: 900,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.12) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      {/* Browser Mockup with 3D tilt */}
      <BrowserMockup
        tiltX={tiltX}
        tiltY={tiltY}
        scale={scale}
        translateY={translateY}
      />

      {/* Floating Pill Badge */}
      <div
        style={{
          position: "absolute",
          bottom: 54,
          left: "50%",
          transform: `translateX(-50%) translateY(${interpolate(
            badgeSpring,
            [0, 1],
            [30, 0]
          )}px) scale(${badgeSpring})`,
          opacity: interpolate(badgeSpring, [0, 1], [0, 1]),
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 28px",
          borderRadius: 999,
          backgroundColor: "rgba(13, 14, 18, 0.92)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(16, 185, 129, 0.4)",
          boxShadow:
            "0 16px 40px -10px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.2)",
          zIndex: 10,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: "#10B981",
            boxShadow: "0 0 12px #10B981",
          }}
        />
        <span
          style={{
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          100% In-Browser Memory (RAM)
        </span>
        <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>
        <span
          style={{
            color: "#10B981",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          Zero Server Uploads
        </span>
      </div>
    </AbsoluteFill>
  );
};
