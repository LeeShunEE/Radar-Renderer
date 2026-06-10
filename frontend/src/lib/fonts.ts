import { loadFont as loadNotoSansSC } from "@remotion/google-fonts/NotoSansSC";
import { loadFont as loadNotoSerifSC } from "@remotion/google-fonts/NotoSerifSC";
import { loadFont as loadZCOOLQKH } from "@remotion/google-fonts/ZCOOLQingKeHuangYou";
import { loadFont as loadZCOOLKL } from "@remotion/google-fonts/ZCOOLKuaiLe";
import { loadFont as loadMaShanZheng } from "@remotion/google-fonts/MaShanZheng";
import { loadFont as loadOrbitron } from "@remotion/google-fonts/Orbitron";
import { loadFont as loadRajdhani } from "@remotion/google-fonts/Rajdhani";
import { loadFont as loadRussoOne } from "@remotion/google-fonts/RussoOne";
import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadExo2 } from "@remotion/google-fonts/Exo2";
import { loadFont as loadAudiowide } from "@remotion/google-fonts/Audiowide";
import { loadFont as loadPressStart2P } from "@remotion/google-fonts/PressStart2P";
import { loadFont as loadBlackOpsOne } from "@remotion/google-fonts/BlackOpsOne";

export const CURATED_FONTS = [
  { name: "sans-serif", label: "默认 (sans-serif)", supportsChinese: true },
  { name: "Noto Sans SC", label: "Noto Sans SC", supportsChinese: true },
  { name: "Noto Serif SC", label: "Noto Serif SC", supportsChinese: true },
  { name: "ZCOOL QingKe HuangYou", label: "ZCOOL QingKe HuangYou", supportsChinese: true },
  { name: "ZCOOL KuaiLe", label: "ZCOOL KuaiLe", supportsChinese: true },
  { name: "Ma Shan Zheng", label: "Ma Shan Zheng", supportsChinese: true },
  { name: "Orbitron", label: "Orbitron" },
  { name: "Rajdhani", label: "Rajdhani" },
  { name: "Russo One", label: "Russo One" },
  { name: "Bebas Neue", label: "Bebas Neue" },
  { name: "Exo 2", label: "Exo 2" },
  { name: "Audiowide", label: "Audiowide" },
  { name: "Press Start 2P", label: "Press Start 2P" },
  { name: "Black Ops One", label: "Black Ops One" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CURATED_LOADERS: Record<string, (...args: any[]) => any> = {
  "Noto Sans SC": loadNotoSansSC,
  "Noto Serif SC": loadNotoSerifSC,
  "ZCOOL QingKe HuangYou": loadZCOOLQKH,
  "ZCOOL KuaiLe": loadZCOOLKL,
  "Ma Shan Zheng": loadMaShanZheng,
  "Orbitron": loadOrbitron,
  "Rajdhani": loadRajdhani,
  "Russo One": loadRussoOne,
  "Bebas Neue": loadBebasNeue,
  "Exo 2": loadExo2,
  "Audiowide": loadAudiowide,
  "Press Start 2P": loadPressStart2P,
  "Black Ops One": loadBlackOpsOne,
};

/** CJK 字体需要 chinese-simplified 子集，拉丁字体只需 latin。 */
const CJK_FONTS = new Set([
  "Noto Sans SC", "Noto Serif SC",
  "ZCOOL QingKe HuangYou", "ZCOOL KuaiLe", "Ma Shan Zheng",
]);

/** 字体加载选项：限制 weights/subsets 避免全字重全子集洪泛（Noto Sans SC 默认 ~909 请求）。 */
function fontLoadOptions(family: string) {
  const subsets = CJK_FONTS.has(family)
    ? ["latin", "chinese-simplified"]
    : ["latin"];
  return { weights: ["400", "700"] as string[], subsets };
}

export async function loadCuratedFonts(): Promise<void> {
  await Promise.all(
    Object.entries(CURATED_LOADERS).map(([name, loader]) =>
      loader("normal", fontLoadOptions(name))
    )
  );
}

const injectedFonts = new Set<string>();

function injectGoogleFontLink(fontFamily: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (injectedFonts.has(fontFamily)) return Promise.resolve();
  injectedFonts.add(fontFamily);
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    fontFamily,
  ).replace(/%20/g, "+")}&display=swap`;
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

export async function loadFontDynamic(fontFamily: string): Promise<void> {
  if (fontFamily === "sans-serif") return;
  if (CURATED_LOADERS[fontFamily]) {
    await CURATED_LOADERS[fontFamily]("normal", fontLoadOptions(fontFamily));
    return;
  }
  await injectGoogleFontLink(fontFamily);
}

export async function loadSelectedFonts(families: string[]): Promise<void> {
  const unique = Array.from(new Set(families)).filter((f) => f && f !== "sans-serif");
  await Promise.all(unique.map(loadFontDynamic));
}
