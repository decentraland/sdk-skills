// promote-scene tool version: 2026-11-27
import { Composition } from "remotion";
import { EDITS, extraSizes } from "./edits";
import { Post } from "./Post";
import { FPS, RATIOS, sec } from "./lib/config";

/**
 * One composition per edit (16:9), plus <id>-9x16, <id>-1x1, <id>-4x5 for the sizes it asks for; with `langs`,
 * each of those once per language (<id>-pt, <id>-9x16-pt).
 */
export const RemotionRoot: React.FC = () => (
  <>
    {EDITS.flatMap((e) => {
      const frames: [string, number, number][] = [["", 1920, 1080], ...extraSizes(e).map((r): [string, number, number] => [`-${r}`, RATIOS[r][0], RATIOS[r][1]])];
      const langs: (string | undefined)[] = e.langs?.length ? e.langs : [undefined];
      return frames.flatMap(([suffix, width, height]) =>
        langs.map((lang) => {
          const id = `${e.id}${suffix}${lang ? `-${lang}` : ""}`;
          return (
            <Composition key={id} id={id} component={Post} fps={FPS} durationInFrames={sec(e.duration)} width={width} height={height} defaultProps={{ editId: e.id, lang }} />
          );
        }),
      );
    })}
  </>
);
