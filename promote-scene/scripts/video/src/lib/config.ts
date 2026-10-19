// Shared constants. Every time in edits.ts is written in seconds; sec() turns it into frames.
import kit from "../../../posts.json";

export const FPS = 30;
export const sec = (s: number): number => Math.round(s * FPS);

/** The kit itself (promote/posts.json): game name, tagline, link, brand colours. */
export const KIT = kit as {
  game: string;
  tagline?: string;
  link?: string;
  brand?: { accent?: string; text?: string; ink?: string };
};
export const ACCENT = KIT.brand?.accent || "#ff3a26";
export const TEXT = KIT.brand?.text || "#f2f2f2";

/** Text sizes are designed at 1920 wide; portrait frames get 80 % of their width's scale so reels stay readable. */
export const textScale = (width: number, height: number): number => (width >= height ? width / 1920 : (width / 1080) * 0.8);
