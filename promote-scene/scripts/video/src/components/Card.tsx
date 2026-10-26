import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Card as CardT } from "../edits";
import { ACCENT, TEXT, textScale } from "../lib/config";
import { DISPLAY_FONT, TEXT_SHADOW } from "../lib/fonts";

const SIZE = { md: 72, lg: 118, xl: 190 } as const;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Text card. "fade" creeps open; "slam" lands on a beat. Sizes scale with the frame width. */
export const Card: React.FC<{ card: CardT }> = ({ card }) => {
  const f = useCurrentFrame();
  const { durationInFrames: d, width, height } = useVideoConfig();
  const { size = "lg", color = "text", pos = "center", anim = "fade", over = false } = card;
  const k = textScale(width, height);
  const slam = anim === "slam";
  const opacity = slam ? interpolate(f, [0, 2, d - 6, d], [0, 1, 1, 0], clamp) : interpolate(f, [0, 12, d - 10, d], [0, 1, 1, 0], clamp);
  const scale = slam ? interpolate(f, [0, 9], [1.35, 1], { ...clamp, easing: Easing.out(Easing.exp) }) : interpolate(f, [0, d], [1, 1.03]);
  const spacing = (slam ? 8 : interpolate(f, [0, d], [8, 18])) * k;
  const fill = color === "text" ? TEXT : color === "accent" ? ACCENT : color;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: over ? "transparent" : "#000",
        justifyContent: pos === "lower" ? "flex-end" : "center",
        alignItems: "center",
        paddingBottom: pos === "lower" ? 200 * k : 0,
        padding: `0 ${80 * k}px`,
        opacity,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          fontFamily: DISPLAY_FONT,
          fontSize: SIZE[size] * k,
          lineHeight: 1.05,
          letterSpacing: spacing,
          paddingLeft: spacing,
          textAlign: "center",
          whiteSpace: "pre-line",
          color: fill,
          textShadow: TEXT_SHADOW,
        }}
      >
        {card.text}
      </div>
    </AbsoluteFill>
  );
};
