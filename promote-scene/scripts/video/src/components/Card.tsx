import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import type { Card as CardT } from "../edits";
import { ACCENT, TEXT, ramp, textScale } from "../lib/config";
import { DISPLAY_FONT, TEXT_SHADOW } from "../lib/fonts";

const SIZE = { md: 72, lg: 118, xl: 190 } as const;

/** Text card. "fade" creeps open; "slam" lands on a beat. Sizes scale with the frame width. */
export const Card: React.FC<{ card: CardT }> = ({ card }) => {
  const f = useCurrentFrame();
  const { durationInFrames: d, width, height } = useVideoConfig();
  const { size = "lg", color = "text", pos = "center", anim = "fade", over = false } = card;
  const k = textScale(width, height);
  const slam = anim === "slam";
  // Fades shrink on short cards (at most a third of the card each) and ramp() keeps the ranges valid at any length.
  const inF = Math.min(slam ? 2 : 12, Math.floor(d / 3));
  const outF = Math.min(slam ? 6 : 10, Math.floor(d / 3));
  const opacity = ramp(f, [0, inF, d - outF, d], [0, 1, 1, 0]);
  const scale = slam ? ramp(f, [0, 9], [1.35, 1], { easing: Easing.out(Easing.exp) }) : ramp(f, [0, d], [1, 1.03]);
  const spacing = (slam ? 8 : ramp(f, [0, d], [8, 18])) * k;
  const fill = color === "text" ? TEXT : color === "accent" ? ACCENT : color;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: over ? "transparent" : "#000",
        justifyContent: pos === "lower" ? "flex-end" : "center",
        alignItems: "center",
        padding: `0 ${80 * k}px ${pos === "lower" ? 200 * k : 0}px`,   // one shorthand: a separate paddingBottom would be overridden
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
