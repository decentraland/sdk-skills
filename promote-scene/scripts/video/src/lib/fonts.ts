import { loadFont as loadLocalFont } from "@remotion/fonts";
import { loadFont as loadGoogleFont } from "@remotion/google-fonts/BebasNeue";
import { staticFile } from "remotion";
import { KIT } from "./config";

// The display face for cards, captions and the end card.
// brand.video_font in posts.json names a .ttf/.otf under promote/fonts/ (public/fonts links there), e.g. "fonts/Impact.ttf":
// copy brand.font there to match the kit's wordmark, and renders then need no network. Without it, Bebas Neue (a bold
// condensed face close to the Impact / DIN pair the images use) is fetched from Google Fonts at render time, so an
// offline render fails until video_font is set.
const local = KIT.brand?.video_font;
export const DISPLAY_FONT: string = local ? "KitDisplay" : loadGoogleFont("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
if (local) loadLocalFont({ family: "KitDisplay", url: staticFile(local), weight: "400" });

/** Legibility over any footage: a thin dark outline plus a soft drop shadow. */
export const TEXT_SHADOW = "0 0 2px #000, 0 0 2px #000, 0 0 3px #000, 0 4px 18px rgba(0,0,0,0.85)";
