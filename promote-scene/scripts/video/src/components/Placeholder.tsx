import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FPS } from "../lib/config";
import { DISPLAY_FONT } from "../lib/fonts";

/** Stand-in for footage that does not exist yet: a moving grid and the label, so the cut can be timed anyway. */
/** pos "top" keeps the label clear of the text cards, which sit in the centre or the lower third. */
export const Placeholder: React.FC<{ label: string; pos?: "center" | "top" }> = ({ label, pos = "center" }) => {
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
      <AbsoluteFill style={{ justifyContent: pos === "top" ? "flex-start" : "center", alignItems: "center", fontFamily: DISPLAY_FONT, color: "rgba(255,255,255,0.9)", textAlign: "center", padding: pos === "top" ? "110px 80px 80px" : 80 }}>
        <div style={{ fontSize: pos === "top" ? 64 : 110, letterSpacing: 4, lineHeight: 1.05 }}>{label}</div>
        <div style={{ fontSize: 40, opacity: 0.55, letterSpacing: 4, marginTop: 16 }}>{(f / FPS).toFixed(2)}s</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
