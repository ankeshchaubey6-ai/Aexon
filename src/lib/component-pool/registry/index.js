import registry from "./components.json" assert { type: "json" };
import { aliases } from "./aliases.js";

/** Resolve a component name (including aliases) to its canonical form */
export function resolveComponent(name) {
  const canonical = aliases[name.toLowerCase().trim()] ?? name;
  return canonical;
}

/** Get all components required for a given site type */
export function getSiteTemplate(type) {
  return registry.siteTypes[type] ?? null;
}

/** Get all component names in a category */
export function getCategory(cat) {
  return registry.categories[cat] ?? [];
}

/** Check if a component exists in the registry */
export function hasComponent(name) {
  const resolved = resolveComponent(name);
  return Object.values(registry.categories).flat().includes(resolved);
}

export default registry;
