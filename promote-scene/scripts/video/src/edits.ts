/**
 * EDIT DECISION LISTS: one entry per post video. The composition id is the post id (promote/posts.json),
 * so `npx remotion render footage-02 ../videos/footage-02.mp4` renders that post's video.
 * All times are seconds from the start of the video. Paths are relative to public/, which links to the
 * kit's folders: images/ (renders, keyart, social), logo/, footage/ (recordings), clips/ (Blender camera
 * moves), music/ (creator-supplied, licensed), fonts/ (optional, see lib/fonts.ts).
 *
 * Sources, best first:
 *   { video: "footage/wind-take2.mp4", trimStart: 3.2 }   a recording from the Explorer
 *   { video: "clips/hero.mp4" }                           render_shots.py -- clip <shot>
 *   { image: "images/renders/hero.png", move: "push" }    a kit still with slow camera motion
 *   { placeholder: "RECORD: the turbine spinning up" }     nothing exists yet (shows a labelled slate)
 */
import { KIT, SLUG } from "./lib/config";

export type Source =
  | { video: string; trimStart?: number; rate?: number; focus?: [number, number] }
  | { image: string; move?: "push" | "pull" | "left" | "right" | "up" | "down"; focus?: [number, number] }
  | { placeholder: string };

/** How a shot arrives: hard cut, cut + camera slam, white flash, dip from black, horizontal whip. */
export type Fx = "cut" | "punch" | "flash" | "dip" | "whip";

export type Shot = {
  from: number;
  to: number;
  src: Source;
  fx?: Fx;
  /** Small lower-third label for the whole shot (a mechanic, a UI callout). */
  caption?: string;
  /** CSS filter for the look, e.g. "saturate(0.7) contrast(1.15)". */
  grade?: string;
};

export type Card = {
  /** Use \n for line breaks. About 6 words per card, verbatim lines from the post. */
  text: string;
  from: number;
  to: number;
  /** true: over the picture; false (default): on black, between shots. */
  over?: boolean;
  size?: "md" | "lg" | "xl";
  /** "text" (default), "accent" (brand.accent from posts.json) or any CSS colour. */
  color?: string;
  pos?: "center" | "lower";
  /** fade: slow and creeping; slam: lands on a beat. */
  anim?: "fade" | "slam";
};

export type EndCard = {
  from: number;
  /** Transparent wordmark or the lockup on black, e.g. "logo/<slug>_lockup_on_black.png". */
  logo: string;
  /** One line under the logo: the tagline, "Coming soon", a date. */
  line?: string;
  /** The jump link, or "" / omitted when not published. */
  link?: string;
  /** Optional key art shown blurred behind the logo. */
  backdrop?: string;
};

export type Edit = {
  /** Post id from posts.json; becomes videos/<id>.mp4. Letters, digits and dashes only. */
  id: string;
  /** Total length in seconds. Footage posts 6-15 s; a trailer at most 30 s. */
  duration: number;
  shots: Shot[];
  cards: Card[];
  end?: EndCard;
  /** Only the scene's own audio or a file the creator supplied with its licence. Never downloaded music. */
  music?: { file: string; volume?: number; fadeOut?: number; trimStart?: number; loop?: boolean } | null;
  /** One-shot sounds at a given second (a stinger, a chime, an intercom line), same sourcing rule. */
  sounds?: { file: string; at: number; volume?: number }[];
  /** Also register <id>-9x16 (1080x1920) for reels and stories. */
  vertical?: boolean;
};

// The example edit below is built from whatever the kit already has (posts.json "images" and make_logo.py's lockup),
// so it renders for any scene; a kit without images gets labelled slates. Replace it with this scene's posts.
const stills = Object.values(KIT.images ?? {}).map((i) => i.file).filter((f) => /^images\//.test(f));
const still = (i: number, move: "push" | "left"): Source => (stills[i] ? { image: stills[i], move } : { placeholder: `RECORD: shot ${i + 1}` });

export const EDITS: Edit[] = [
  {
    id: "example",
    duration: 10,
    vertical: true,
    shots: [
      { from: 0, to: 4, src: still(0, "push"), fx: "dip" },
      { from: 4, to: 7.5, src: still(1, "left"), fx: "cut" },
    ],
    cards: [
      { text: (KIT.tagline || "YOUR TAGLINE HERE").toUpperCase(), from: 0.6, to: 3.6, over: true, size: "lg", anim: "fade" },
      { text: KIT.game.toUpperCase(), from: 4.4, to: 7.2, over: true, size: "md", pos: "lower", anim: "slam" },
    ],
    end: { from: 7.5, logo: `logo/${SLUG}_lockup_on_black.png`, line: KIT.link ? "LIVE ON DECENTRALAND" : "COMING SOON", link: KIT.link || "" },
    music: null,
  },
];

export const getEdit = (id: string): Edit => {
  const e = EDITS.find((x) => x.id === id);
  if (!e) throw new Error(`No edit with id ${id} in src/edits.ts`);
  return e;
};
