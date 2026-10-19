import { loadFont } from "@remotion/google-fonts/BebasNeue";

// A bold condensed display face, close to the Impact / DIN Condensed pair the kit's images use.
export const { fontFamily: DISPLAY_FONT } = loadFont("normal", { weights: ["400"], subsets: ["latin"] });

/** Legibility over any footage: a thin dark outline plus a soft drop shadow. */
export const TEXT_SHADOW = "0 0 2px #000, 0 0 2px #000, 0 0 3px #000, 0 4px 18px rgba(0,0,0,0.85)";
