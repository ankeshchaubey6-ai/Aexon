/**
 * Load the code snippet for a given component to inject into the AI context.
 * Uses dynamic import so only needed snippets are sent, keeping prompt size down.
 */
export async function loadSnippet(componentName) {
  try {
    const mod = await import(`../../lib/component-pool/snippets/generated/all-snippets.json`, { assert: { type: "json" } });
    return mod.default[componentName] ?? null;
  } catch {
    return null;
  }
}

/** Load snippets for an array of component names */
export async function loadSnippets(names) {
  const results = await Promise.all(names.map(n => loadSnippet(n)));
  return Object.fromEntries(names.map((n, i) => [n, results[i]]).filter(([, v]) => v));
}
