// 映像の音の区切り（src/timeline.ts の MUSIC_MARKS、秒）を JSON で書き出す。scripts/music.py に渡す。
//   node scripts/marks.mjs | python scripts/music.py public/sound        (npm run music)
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const out = await build({ entryPoints: ["src/timeline.ts"], bundle: true, format: "esm", platform: "node", external: ["remotion"], write: false });
mkdirSync("node_modules/.cache", { recursive: true });
const file = "node_modules/.cache/timeline.mjs";
writeFileSync(file, out.outputFiles[0].text);
const { MUSIC_MARKS } = await import(pathToFileURL(file).href);
process.stdout.write(JSON.stringify(MUSIC_MARKS));
