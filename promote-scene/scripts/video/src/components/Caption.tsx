import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ACCENT, TEXT, textScale } from "../lib/config";
import { DISPLAY_FONT, TEXT_SHADOW } from "../lib/fonts";

/** Small bottom-centre label for a shot (a mechanic, an item, a UI callout). */
export const Caption: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const k = textScale(width, height);
  const opacity = interpolate(f, [0, 5], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(f, [0, 8], [24, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 110 * k }}>
      <div
        style={{
          opacity,
          transform: `translateY(${y}px)`,
          fontFamily: DISPLAY_FONT,
          fontSize: 60 * k,
          letterSpacing: 5 * k,
          color: TEXT,
          padding: `${6 * k}px ${26 * k}px ${2 * k}px`,
          background: "rgba(0,0,0,0.6)",
          borderLeft: `${8 * k}px solid ${ACCENT}`,
          textShadow: TEXT_SHADOW,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
