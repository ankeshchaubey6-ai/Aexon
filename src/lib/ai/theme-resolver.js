import { baseTheme } from "../../lib/component-pool/themes/base.js";
import { darkTheme }  from "../../lib/component-pool/themes/dark.js";
import { saasTheme }  from "../../lib/component-pool/themes/saas.js";

/** Resolve a merged theme object from a selection context */
export function resolveTheme({ mode = "light", preset = "base" } = {}) {
  const presets = { saas: saasTheme };
  const base = { ...baseTheme, ...(presets[preset] ?? {}) };
  return mode === "dark" ? { ...base, colors: { ...base.colors, ...darkTheme.colors } } : base;
}

/** Generate CSS custom properties string from a theme */
export function themeToCSSVars(theme) {
  const lines = [];
  const flatten = (obj, prefix = "--") => {
    for (const [k, v] of Object.entries(obj)) {
      const key = `${prefix}${k.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
      if (typeof v === "object" && v !== null) flatten(v, key + "-");
      else lines.push(`  ${key}: ${v};`);
    }
  };
  flatten(theme.colors, "--color-");
  return `:root {\n${lines.join("\n")}\n}`;
}
