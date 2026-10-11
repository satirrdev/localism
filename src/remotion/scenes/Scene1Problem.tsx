import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const Scene1Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring for the alert tag
  const tagSpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  // Entrance springs for the headline text
  const line1Spring = spring({
    frame: frame - 6,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const line2Spring = spring({
    frame: frame - 14,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  // Accent line expand spring
  const lineScaleX = spring({
    frame: frame - 20,
    fps,
    config: { damping: 18, stiffness: 140 },
  });

  // Warning pulse
  const pulse = Math.sin(frame / 6) * 0.15 + 0.85;

  // Exit transition towards frame 80-90
  const exitProgress = interpolate(frame, [72, 88], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitScale = 1 - exitProgress * 0.08;
  const exitOpacity = 1 - exitProgress;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0A0A0C",
        justifyContent: "center",
        alignItems: "center",
        opacity: exitOpacity,
        transform: `scale(${exitScale})`,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Geist Sans", sans-serif',
      }}
    >
      {/* Subtle background ambient warning glow */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.04) 40%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: 1200,
          padding: "0 40px",
          zIndex: 1,
        }}
      >
        {/* Warning Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 18px",
            borderRadius: 999,
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            marginBottom: 36,
            opacity: interpolate(tagSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(tagSpring, [0, 1], [24, 0])}px) scale(${tagSpring})`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#EF4444",
              boxShadow: `0 0 ${12 * pulse}px #EF4444`,
            }}
          />
          <span
            style={{
              color: "#F87171",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Privacy Risk Detected
          </span>
        </div>

        {/* Kinetic Headline Line 1 */}
        <h1
          style={{
            fontSize: 68,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            margin: 0,
            opacity: interpolate(line1Spring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(line1Spring, [0, 1], [40, 0])}px)`,
          }}
        >
          Still uploading sensitive files
        </h1>

        {/* Kinetic Headline Line 2 */}
        <h1
          style={{
            fontSize: 68,
            fontWeight: 800,
            color: "#A1A1AA",
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            marginTop: 8,
            marginBottom: 36,
            opacity: interpolate(line2Spring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(line2Spring, [0, 1], [40, 0])}px)`,
          }}
        >
          to cloud converters?
        </h1>

        {/* High-contrast amber/red warning accent line */}
        <div
          style={{
            width: 480,
            height: 3,
            borderRadius: 2,
            background:
              "linear-gradient(90deg, transparent 0%, #EF4444 30%, #F59E0B 70%, transparent 100%)",
            boxShadow: "0 0 20px rgba(239, 68, 68, 0.5)",
            transform: `scaleX(${Math.max(0, lineScaleX)})`,
            transformOrigin: "center",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
