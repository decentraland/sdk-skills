import { useState } from "react";
import { Img, staticFile } from "remotion";
import { Placeholder } from "./Placeholder";

/**
 * <Img> for a file from the kit. A file that is not there yet (the social images before compose_social.py,
 * the lockup before make_logo.py) renders the fallback (default: a "MISSING: <file>" slate) instead of
 * cancelling the render, so the example edit and a draft cut always produce a video.
 */
export const KitImg: React.FC<{ file: string; style?: React.CSSProperties; fallback?: React.ReactNode }> = ({ file, style, fallback }) => {
  const [missing, setMissing] = useState(false);
  if (missing) return <>{fallback === undefined ? <Placeholder label={`MISSING: ${file}`} pos="top" /> : fallback}</>;
  return (
    <Img
      src={staticFile(file)}
      style={style}
      maxRetries={0}
      onError={() => {
        console.warn(`KitImg: ${file} is not in public/; rendering the fallback`);
        setMissing(true);
      }}
    />
  );
};
