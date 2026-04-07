// src/lib/ai/engine/component-registry.ts

export function buildComponentRegistry(files: { path: string; content: string }[]) {
  const registry = new Map<string, string>();

  for (const file of files) {
    const matches = file.content.matchAll(
      /(?:export\s+default\s+function|export\s+function|const|function)\s+([A-Z][A-Za-z0-9]*)/g
    );

    for (const m of matches) {
      registry.set(m[1], file.path);
    }
  }

  return registry;
}