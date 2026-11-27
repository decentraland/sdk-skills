// promote-scene tool version: 2026-11-27
import { Composition } from "remotion";
import { EDITS, extraSizes } from "./edits";
import { Post } from "./Post";
import { FPS, RATIOS, sec } from "./lib/config";

/**
 * One composition per edit (16:9), plus <id>-9x16, <id>-1x1, <id>-4x5 for the sizes it asks for; with `langs`,
 * each of those once per language (<id>-pt, <id>-9x16-pt), and the bare ids (<id>, <id>-9x16) render the first
 * language, so the usual render commands and the kit's videos/<id>.mp4 still work.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {EDITS.flatMap((e) => {
      const frames: [string, number, number][] = [["", 1920, 1080], ...extraSizes(e).map((r): [string, number, number] => [`-${r}`, RATIOS[r][0], RATIOS[r][1]])];
      // [id suffix, language]: the bare id first (no language, or the edit's first one), then one per language
      const langs: [string, string | undefined][] = e.langs?.length
        ? [["", e.langs[0]], ...e.langs.map((l): [string, string] => [`-${l}`, l])]
        : [["", undefined]];
      return frames.flatMap(([suffix, width, height]) =>
        langs.map(([tag, lang]) => {
          const id = `${e.id}${suffix}${tag}`;
          return (
            <Composition key={id} id={id} component={Post} fps={FPS} durationInFrames={sec(e.duration)} width={width} height={height} defaultProps={{ editId: e.id, lang }} />
          );
        }),
      );
    })}
  </>
);
