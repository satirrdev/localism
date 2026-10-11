import React from "react";
import { Img, staticFile } from "remotion";

interface BrowserMockupProps {
  tiltX?: number;
  tiltY?: number;
  scale?: number;
  translateY?: number;
}

export const BrowserMockup: React.FC<BrowserMockupProps> = ({
  tiltX = 0,
  tiltY = 0,
  scale = 1,
  translateY = 0,
}) => {
  return (
    <div
      style={{
        transform: `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(${translateY}px) scale(${scale})`,
        transformStyle: "preserve-3d",
        width: 1400,
        height: 788,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#0D0E12",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow:
          "0 32px 80px -20px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.08)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Browser Chrome Header (macOS style) */}
      <div
        style={{
          height: 44,
          backgroundColor: "#14151B",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          position: "relative",
          zIndex: 2,
          flexShrink: 0,
        }}
      >
        {/* Window controls (macOS 3 dots) */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#FF5F56",
              boxShadow: "0 0 6px rgba(255, 95, 86, 0.4)",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#FFBD2E",
              boxShadow: "0 0 6px rgba(255, 189, 46, 0.4)",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#27C93F",
              boxShadow: "0 0 6px rgba(39, 201, 63, 0.4)",
            }}
          />
        </div>

        {/* Address Bar */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            width: 480,
            height: 28,
            borderRadius: 8,
            backgroundColor: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 12,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
            color: "#A1A1AA",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#10B981",
              boxShadow: "0 0 6px #10B981",
            }}
          />
          <span style={{ color: "#E4E4E7", fontWeight: 500 }}>https://</span>
          <span>satirrdev.github.io/localism</span>
        </div>

        {/* Status pill right */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "#10B981",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 999,
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
          }}
        >
          <span>● 100% OFFLINE</span>
        </div>
      </div>

      {/* Viewport content with Screenshot */}
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#050505",
        }}
      >
        <Img
          src={staticFile("screenshot-app.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
            display: "block",
          }}
        />
      </div>
    </div>
  );
};
