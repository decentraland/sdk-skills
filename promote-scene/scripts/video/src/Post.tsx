import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { Card } from "./components/Card";
import { EndCard } from "./components/EndCard";
import { Shot } from "./components/Shot";
import { getEdit } from "./edits";
import { sec } from "./lib/config";

/** Renders one edit: shots, cards over or between them, the end card, music, a soft vignette. */
export const Post: React.FC<{ editId: string }> = ({ editId }) => {
  const edit = getEdit(editId);
  const { durationInFrames } = useVideoConfig();
  const music = edit.music;
  const fade = sec(music?.fadeOut ?? 1.5);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {music && (
        <Audio
          src={staticFile(music.file)}
          trimBefore={sec(music.trimStart ?? 0)}
          loop={music.loop ?? false}
          volume={(f) =>
            interpolate(f, [0, sec(0.5), durationInFrames - fade, durationInFrames - 1], [0, music.volume ?? 0.8, music.volume ?? 0.8, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      )}
      {(edit.sounds ?? []).map((snd, i) => (
        <Sequence key={`snd${i}`} name={`sound ${snd.file}`} from={sec(snd.at)}>
          <Audio src={staticFile(snd.file)} volume={snd.volume ?? 1} />
        </Sequence>
      ))}
      {edit.shots.map((s, i) => (
        <Sequence key={i} name={`shot ${i + 1}`} from={sec(s.from)} durationInFrames={sec(s.to) - sec(s.from)}>
          <Shot shot={s} />
        </Sequence>
      ))}
      {edit.cards.map((c, i) => (
        <Sequence key={i} name={`card ${i + 1}`} from={sec(c.from)} durationInFrames={sec(c.to) - sec(c.from)}>
          <Card card={c} />
        </Sequence>
      ))}
      {edit.end && (
        <Sequence name="end card" from={sec(edit.end.from)} durationInFrames={durationInFrames - sec(edit.end.from)}>
          <EndCard end={edit.end} />
        </Sequence>
      )}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
