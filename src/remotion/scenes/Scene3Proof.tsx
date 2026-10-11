import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrowserMockup } from "../components/BrowserMockup";

export const Scene3Proof: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Camera zoom spring (moving into center)
  const zoomSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 60, mass: 1.2 },
  });

  // Glowing pill badge entrance
  const badgeSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  // Supporting cards entrance
  const cardsSpring = spring({
    frame: frame - 22,
    fps,
    config: { damping: 16, stiffness: 100 },
  });

  // Camera zoom: from 0.98 to 1.35
  const cameraScale = interpolate(zoomSpring, [0, 1], [0.98, 1.35]);
  const cameraTranslateY = interpolate(zoomSpring, [0, 1], [20, -70]);

  // Emerald pulsing dot
  const pulse = Math.sin(frame / 5) * 0.25 + 0.75;

  // Exit transition towards Scene 4
  const exitProgress = interpolate(frame, [72, 88], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOpacity = 1 - exitProgress;
  const exitScale = 1 + exitProgress * 0.05;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0A0A0C",
        justifyContent: "center",
        alignItems: "center",
        opacity: exitOpacity,
        transform: `scale(${exitScale})`,
        overflow: "hidden",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Geist Sans", sans-serif',
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.16) 0%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />

      {/* Browser Mockup zoomed in center */}
      <div
        style={{
          opacity: 0.45,
          filter: "blur(2px)",
          transition: "filter 0.3s ease",
        }}
      >
        <BrowserMockup
          scale={cameraScale}
          translateY={cameraTranslateY}
          tiltX={0}
          tiltY={0}
        />
      </div>

      {/* Dark overlay for contrast */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(10, 10, 12, 0.65)",
          backdropFilter: "blur(8px)",
        }}
      />

      {/* Proof Centerpiece */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* Glow Pill Badge */}
        <div
          style={{
            transform: `scale(${badgeSpring})`,
            opacity: interpolate(badgeSpring, [0, 1], [0, 1]),
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
            padding: "20px 42px",
            borderRadius: 999,
            backgroundColor: "#0D0E12",
            border: "2px solid #10B981",
            boxShadow: `0 0 ${40 * pulse}px rgba(16, 185, 129, 0.45), 0 24px 60px rgba(0, 0, 0, 0.9)`,
          }}
        >
          {/* Emerald pulsing status dot */}
          <div
            style={{
              position: "relative",
              width: 14,
              height: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                backgroundColor: "#10B981",
                opacity: 0.6,
                transform: `scale(${1 + pulse * 0.8})`,
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: "#10B981",
                boxShadow: "0 0 14px #10B981",
              }}
            />
          </div>

          <span
            style={{
              color: "#FFFFFF",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Network Tab:{" "}
            <span style={{ color: "#10B981", fontWeight: 800 }}>
              0 Requests Sent
            </span>
          </span>

          <span style={{ color: "rgba(255, 255, 255, 0.2)", fontSize: 22 }}>
            •
          </span>

          <span
            style={{
              color: "#34D399",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            Airplane Mode Verified
          </span>
        </div>

        {/* Technical Sub-badges */}
        <div
          style={{
            display: "flex",
            gap: 16,
            opacity: interpolate(cardsSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(cardsSpring, [0, 1], [24, 0])}px)`,
          }}
        >
          {[
            { label: "MEMORY SANDBOX", val: "RAM Only, Zero Leak" },
            { label: "WASM CORES", val: "FFmpeg + Tesseract SIMD" },
            { label: "NO THIRD-PARTY API", val: "100% Same-Origin" },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: "12px 22px",
                borderRadius: 14,
                backgroundColor: "rgba(20, 22, 28, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "#10B981",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#E4E4E7",
                }}
              >
                {item.val}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
