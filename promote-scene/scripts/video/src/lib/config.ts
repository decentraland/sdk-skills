// Shared constants. Every time in edits.ts is written in seconds; sec() turns it into frames.
import { interpolate } from "remotion";
import kit from "../../../posts.json";

export const FPS = 30;
export const sec = (s: number): number => Math.round(s * FPS);

/** The kit itself (promote/posts.json): game name, tagline, link, brand colours, the image list. */
export const KIT = kit as {
  game: string;
  tagline?: string;
  link?: string;
  brand?: { accent?: string; text?: string; ink?: string; video_font?: string };
  images?: Record<string, { file: string; alt?: string }>;
};
export const ACCENT = KIT.brand?.accent || "#ff3a26";
export const TEXT = KIT.brand?.text || "#f2f2f2";
/** make_logo.py's file-name slug: logo/<slug>_wordmark.png, logo/<slug>_lockup_on_black.png. */
export const SLUG = KIT.game.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Text sizes are designed at 1920 wide; portrait frames get 80 % of their width's scale so reels stay readable. */
export const textScale = (width: number, height: number): number => (width >= height ? width / 1920 : (width / 1080) * 0.8);

/**
 * interpolate() with the input range forced strictly increasing (each point at least one frame after the
 * previous) and clamped at both ends, so a card shorter than its fades or a music fadeOut of 0 never throws.
 */
export const ramp = (frame: number, inputs: number[], outputs: number[], opts?: { easing?: (t: number) => number }): number => {
  const xs = inputs.slice();
  for (let i = 1; i < xs.length; i++) if (xs[i] <= xs[i - 1]) xs[i] = xs[i - 1] + 1;
  return interpolate(frame, xs, outputs, { extrapolateLeft: "clamp", extrapolateRight: "clamp", ...opts });
};
