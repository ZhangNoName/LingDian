import type { Plugin } from "vite";
import { h } from "vue";
import { renderToString } from "vue/server-renderer";
import { miniappGlyphs } from "../packages/icons/src/miniapp";
import theme from "../theme/miniapp-tokens.json";

// WeChat can display SVG images, but cannot register Vue render functions as WXML components.
export function miniappIconImages(): Plugin {
  const id = "virtual:lingdian-miniapp-icons";
  const colors = { text: theme.light.text, muted: theme.light.textMuted, primary: theme.light.primary, white: theme.light.bgSurface };
  return {
    name: "lingdian-miniapp-icon-images",
    resolveId(source) { if (source === id) return "\0" + id; },
    async load(source) {
      if (source !== "\0" + id) return;
      const images: Record<string, Record<string, string>> = {};
      for (const [name, icon] of Object.entries(miniappGlyphs)) {
        const variants: Record<string, string> = {};
        for (const [tone, color] of Object.entries(colors)) {
          const svg = await renderToString(h(icon, { color }));
          variants[tone] = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
        }
        images[name] = variants;
      }
      return "export default " + JSON.stringify(images);
    },
  };
}
