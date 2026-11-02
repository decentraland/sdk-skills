import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import type { EndCard as EndT } from "../edits";
import { ACCENT, KIT, TEXT, ramp, textScale } from "../lib/config";
import { DISPLAY_FONT, TEXT_SHADOW } from "../lib/fonts";
import { KitImg } from "./KitImg";

/** Logo slams in on black (or over blurred key art), a line and the link below, fade to black at the end. */
export const EndCard: React.FC<{ end: EndT }> = ({ end }) => {
  const f = useCurrentFrame();
  const { durationInFrames: d, width, height } = useVideoConfig();
  const k = textScale(width, height);
  const settle = ramp(f, [0, 12], [1.25, 1], { easing: Easing.out(Easing.exp) });
  const reveal = ramp(f, [10, 22], [0, 1]);
  const fadeOut = ramp(f, [d - 20, d - 1], [0, 1]);
  const link = (end.link || "").replace(/^https?:\/\//, "");
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily: DISPLAY_FONT, color: TEXT }}>
      {end.backdrop && (
        <KitImg file={end.backdrop} fallback={null} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.25)", transform: "scale(1.2)" }} />
      )}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: `0 ${120 * k}px` }}>
        {/* no lockup yet (make_logo.py not run): the game name stands in, so the cut can still be timed */}
        <KitImg
          file={end.logo}
          style={{ maxWidth: "70%", maxHeight: "48%", objectFit: "contain", transform: `scale(${settle})` }}
          fallback={<div style={{ fontSize: 150 * k, letterSpacing: 8 * k, textAlign: "center", textShadow: TEXT_SHADOW, transform: `scale(${settle})` }}>{KIT.game.toUpperCase()}</div>}
        />
        {end.line && (
          <div style={{ marginTop: 50 * k, fontSize: 54 * k, letterSpacing: 6 * k, opacity: reveal, textAlign: "center", textShadow: TEXT_SHADOW }}>
            {end.line}
          </div>
        )}
        {link && (
          <div style={{ marginTop: 18 * k, fontSize: 44 * k, letterSpacing: 2 * k, color: ACCENT, opacity: reveal, textShadow: TEXT_SHADOW }}>
            {link}
          </div>
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeOut }} />
    </AbsoluteFill>
  );
};
