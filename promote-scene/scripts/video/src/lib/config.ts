// Shared constants. Every time in edits.ts is written in seconds; sec() turns it into frames.
import { createContext, useContext } from "react";
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

/** Text sizes are designed at 1920 wide; square and portrait frames get 80 % of their width's scale so feeds stay readable. */
export const textScale = (width: number, height: number): number => (width > height ? width / 1920 : (width / 1080) * 0.8);

/**
 * On-screen text: one string, or one per language ({ pt: "Jogue grátis", en: "Play free" }) for an edit with
 * `langs`. A language missing from a map stops the render, so no variant ships with another language's line.
 */
export type Text = string | Record<string, string>;
export const LangContext = createContext<string | undefined>(undefined);
export const pick = (t: Text | undefined, lang: string | undefined): string | undefined => {
  if (t === undefined) return t;
  // in an edit with `langs` every line names its language: a plain string would ship untranslated in all of them
  if (typeof t === "string") {
    if (lang !== undefined) throw new Error(`Untranslated line in an edit with langs: give { "${lang}": … } for ${JSON.stringify(t)}`);
    return t;
  }
  const k = lang ?? Object.keys(t)[0];
  if (!(k in t)) throw new Error(`No "${k}" text in ${JSON.stringify(t)}`);
  return t[k];
};
/** The text in the language of the composition being rendered. */
export const useText = (t: Text | undefined): string | undefined => pick(t, useContext(LangContext));

/** Extra sizes an edit can render besides 16:9 (composition id <id>-<ratio>). */
export const RATIOS = { "9x16": [1080, 1920], "1x1": [1080, 1080], "4x5": [1080, 1350] } as const;
export type Ratio = keyof typeof RATIOS;

/**
 * Margins text must stay inside, in pixels. 9:16 uses the platforms' safe zone on 1080x1920 (x 120-960,
 * y 240-1260): Reels, TikTok and Shorts draw their buttons and caption over the rest. Other sizes keep a plain margin.
 */
export const safeArea = (width: number, height: number): { top: number; bottom: number; side: number } =>
  height / width > 1.7 ? { top: height * 0.125, bottom: height * 0.34375, side: width / 9 } : { top: 0, bottom: 0, side: 80 * textScale(width, height) };

/**
 * interpolate() with the input range forced strictly increasing (each point at least one frame after the
 * previous) and clamped at both ends, so a card shorter than its fades or a music fadeOut of 0 never throws.
 */
export const ramp = (frame: number, inputs: number[], outputs: number[], opts?: { easing?: (t: number) => number }): number => {
  const xs = inputs.slice();
  for (let i = 1; i < xs.length; i++) if (xs[i] <= xs[i - 1]) xs[i] = xs[i - 1] + 1;
  return interpolate(frame, xs, outputs, { extrapolateLeft: "clamp", extrapolateRight: "clamp", ...opts });
};
