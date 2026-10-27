import { Composition } from "remotion";
import { FPS } from "./anim";
import { Promo } from "./Promo";
import { TOTAL } from "./timeline";

export function Root() {
  return <Composition id="Promo" component={Promo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />;
}
