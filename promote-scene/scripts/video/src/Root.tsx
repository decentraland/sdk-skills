import { Composition } from "remotion";
import { EDITS } from "./edits";
import { Post } from "./Post";
import { FPS, sec } from "./lib/config";

/** One composition per edit (16:9), plus <id>-9x16 when the edit asks for a vertical cut. */
export const RemotionRoot: React.FC = () => (
  <>
    {EDITS.flatMap((e) => {
      const common = { component: Post, fps: FPS, durationInFrames: sec(e.duration), defaultProps: { editId: e.id } };
      const list = [<Composition key={e.id} id={e.id} width={1920} height={1080} {...common} />];
      if (e.vertical) list.push(<Composition key={`${e.id}-9x16`} id={`${e.id}-9x16`} width={1080} height={1920} {...common} />);
      return list;
    })}
  </>
);
