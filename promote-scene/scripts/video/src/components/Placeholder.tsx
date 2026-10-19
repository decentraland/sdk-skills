import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FPS } from "../lib/config";
import { DISPLAY_FONT } from "../lib/fonts";

/** Stand-in for footage that does not exist yet: a moving grid and the label, so the cut can be timed anyway. */
export const Placeholder: React.FC<{ label: string }> = ({ label }) => {
  const f = useCurrentFrame();
  const drift = (f * 3) % 120;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 55%, hsl(205 45% 22%), hsl(205 55% 6%))" }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.10) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.10) 2px, transparent 2px)",
          backgroundSize: "120px 120px",
          backgroundPosition: `${drift}px ${drift}px`,
        }}
      />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: DISPLAY_FONT, color: "rgba(255,255,255,0.9)", textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 110, letterSpacing: 4, lineHeight: 1.05 }}>{label}</div>
        <div style={{ fontSize: 40, opacity: 0.55, letterSpacing: 4, marginTop: 16 }}>{(f / FPS).toFixed(2)}s</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
