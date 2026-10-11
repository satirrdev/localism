import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const Scene4Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring for logo & title
  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  // Entrance spring for tagline
  const taglineSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 110 },
  });

  // Entrance spring for CTA link & license badge
  const ctaSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 16, stiffness: 120 },
  });

  // Ambient breathing pulse
  const pulse = Math.sin(frame / 6) * 0.15 + 0.85;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0A0A0C",
        justifyContent: "center",
        alignItems: "center",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Geist Sans", sans-serif',
      }}
    >
      {/* Background ambient radial emerald wash */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, rgba(16, 185, 129, 0.18) 0%, rgba(16, 185, 129, 0.04) 50%, transparent 75%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* Category micro-label */}
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#10B981",
            marginBottom: 16,
            opacity: interpolate(logoSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(logoSpring, [0, 1], [16, 0])}px)`,
          }}
        >
          Privacy-First Utility Suite
        </p>

        {/* Centered Title Lockup: LOCALISM */}
        <h1
          style={{
            fontSize: 92,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            color: "#FFFFFF",
            margin: 0,
            lineHeight: 1,
            opacity: interpolate(logoSpring, [0, 1], [0, 1]),
            transform: `scale(${logoSpring})`,
            textShadow: "0 0 50px rgba(16, 185, 129, 0.3)",
          }}
        >
          LOCALISM
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: "#A1A1AA",
            letterSpacing: "-0.01em",
            marginTop: 20,
            marginBottom: 36,
            opacity: interpolate(taglineSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(taglineSpring, [0, 1], [24, 0])}px)`,
          }}
        >
          Free. Offline. Open Source.
        </p>

        {/* Call to action & AGPLv3 badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            opacity: interpolate(ctaSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(ctaSpring, [0, 1], [24, 0])}px) scale(${ctaSpring})`,
          }}
        >
          {/* Link Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "16px 32px",
              borderRadius: 999,
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.5)",
              boxShadow: `0 0 ${20 * pulse}px rgba(16, 185, 129, 0.25)`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#10B981",
                boxShadow: "0 0 10px #10B981",
              }}
            />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 18,
                fontWeight: 700,
                color: "#FFFFFF",
                letterSpacing: "0.02em",
              }}
            >
              satirrdev.github.io/localism
            </span>
          </div>

          {/* AGPLv3 Badge */}
          <div
            style={{
              padding: "16px 24px",
              borderRadius: 999,
              backgroundColor: "#14151B",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              fontFamily: "monospace",
              fontSize: 16,
              fontWeight: 700,
              color: "#38BDF8",
              letterSpacing: "0.06em",
            }}
          >
            AGPLv3
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
