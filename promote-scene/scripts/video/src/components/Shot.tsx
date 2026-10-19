import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Shot as ShotT, Source } from "../edits";
import { sec } from "../lib/config";
import { Caption } from "./Caption";
import { Placeholder } from "./Placeholder";

const out = Easing.out(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Slow camera motion over a still: push in, pull out, or drift sideways / vertically. */
const KenBurns: React.FC<{ src: string; move?: string; focus?: [number, number] }> = ({ src, move = "push", focus = [50, 50] }) => {
  const f = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const t = interpolate(f, [0, d], [0, 1], clamp);
  const scale = move === "pull" ? 1.12 - 0.1 * t : 1.04 + 0.08 * t;
  const dx = move === "left" ? -3 * t : move === "right" ? 3 * t : 0;
  const dy = move === "up" ? -3 * t : move === "down" ? 3 * t : 0;
  return (
    <Img
      src={staticFile(src)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: `${focus[0]}% ${focus[1]}%`,
        transform: `translate(${dx}%, ${dy}%) scale(${scale})`,
      }}
    />
  );
};

const Media: React.FC<{ src: Source }> = ({ src }) => {
  if ("placeholder" in src) return <Placeholder label={src.placeholder} />;
  if ("image" in src) return <KenBurns src={src.image} move={src.move} focus={src.focus} />;
  const focus = src.focus ?? [50, 50];
  return (
    <OffthreadVideo
      src={staticFile(src.video)}
      trimBefore={sec(src.trimStart ?? 0)}
      playbackRate={src.rate ?? 1}
      muted
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${focus[0]}% ${focus[1]}%` }}
    />
  );
};

/** One shot: its media, a slow push, the arrival fx, an optional lower-third caption. */
export const Shot: React.FC<{ shot: ShotT }> = ({ shot }) => {
  const f = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const fx = shot.fx ?? "cut";
  const isVideo = "video" in shot.src;
  let scale = isVideo ? interpolate(f, [0, d], [1.0, 1.04], clamp) : 1;
  let x = 0;
  let blur = 0;
  if (fx === "punch") scale *= interpolate(f, [0, 9], [1.16, 1], { ...clamp, easing: out });
  if (fx === "whip") {
    x = interpolate(f, [0, 7], [240, 0], { ...clamp, easing: out });
    blur = interpolate(f, [0, 7], [20, 0], clamp);
  }
  const flash = fx === "flash" ? interpolate(f, [0, 7], [0.9, 0], clamp) : 0;
  const dip = fx === "dip" ? interpolate(f, [0, 8], [1, 0], clamp) : 0;
  const grade = shot.grade ?? "contrast(1.05) saturate(0.95)";
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateX(${x}px) scale(${scale})`, filter: `${grade}${blur ? ` blur(${blur}px)` : ""}` }}>
        <Media src={shot.src} />
      </AbsoluteFill>
      {shot.caption && <Caption text={shot.caption} />}
      {flash > 0 && <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />}
      {dip > 0 && <AbsoluteFill style={{ backgroundColor: "#000", opacity: dip }} />}
    </AbsoluteFill>
  );
};
