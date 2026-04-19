console.log("🔥 [WC-REAL] CORRECT FILE LOADED — use-webcontainer.ts (NPM INSTALL BUILD)");

import { useState, useCallback, useEffect } from "react";
import { WebContainer } from "@webcontainer/api";
import type { FileSystemTree } from "@webcontainer/api";
import { loadSnapshot } from "@/lib/webcontainer/snapshot-loader";

type AIFile = { path: string; content: string };

export type WCStatus =
  | "idle"
  | "waiting-files"
  | "booting"
  | "mounting"
  | "installing"
  | "starting"
  | "writing"
  | "restarting"
  | "running"
  | "error";

const VITE_TIMEOUT_MS = 60_000;

const SNAPSHOT_SUPPORTED_PACKAGES = new Set([
  "esbuild",
  "esbuild-wasm",
  "postcss",
  "react",
  "react-dom",
  "react-refresh",
  "scheduler",
  "loose-envify",
  "rollup",
  "vite",
]);

const SNAPSHOT_REQUIRED_FILES = [
  "node_modules/vite/dist/node/cli.js",
  "node_modules/react/package.json",
  "node_modules/react-dom/package.json",
  "node_modules/scheduler/package.json",
  "node_modules/loose-envify/package.json",
  "node_modules/esbuild/bin/esbuild",
  "node_modules/esbuild-wasm/bin/esbuild",
  "node_modules/esbuild-wasm/esbuild.wasm",
  "node_modules/esbuild-wasm/wasm_exec_node.js",
];

const SNAPSHOT_EXECUTABLE_FILES = [
  "node_modules/esbuild-wasm/bin/esbuild",
];

const PREVIEW_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
  "https://images.unsplash.com/photo-1516321318423-f06f70504b6f",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800",
  "https://images.unsplash.com/photo-1552664730-d307ca884978",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
  "https://images.unsplash.com/photo-1560264357-8d9766c54b0f",
  "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37",
];

const PREVIEW_THEMED_FALLBACK_IMAGES: Record<string, string[]> = {
  car: [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7",
    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341",
  ],
  auto: [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7",
    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341",
  ],
  vehicle: [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7",
    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341",
  ],
  food: [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe",
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
  ],
  travel: [
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800",
  ],
  tech: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
  ],
};

// ━━━ SINGLETON WEBCONTAINER INSTANCE ━━━
// WebContainer.boot() can only be called once per page. This singleton ensures we never
// attempt to boot more than once, even across project switches.
let _wcInstance: WebContainer | null = null;
let _bootPromise: Promise<WebContainer> | null = null;

async function getOrBootInstance(): Promise<WebContainer> {
  if (_wcInstance) return _wcInstance;
  if (_bootPromise) return _bootPromise;

  console.log("[WC] Booting WebContainer…");
  _bootPromise = WebContainer.boot()
    .then((wc) => {
      _wcInstance = wc;
      _bootPromise = null;
      console.log("[WC] Boot complete");
      return wc;
    })
    .catch((err) => {
      _bootPromise = null;
      throw err;
    });
  return _bootPromise;
}

let _globalStatus: WCStatus = "idle";
let _globalUrl: string | null = null;
let _devProcess: Awaited<ReturnType<WebContainer["spawn"]>> | null = null;
let _activeProjectId: string | null = null;
let _runGeneration = 0;
let _isRemounting = false;  // 🔧 FIX 1: Guard against concurrent remounts (not for cache-buster)

let _babelPatched = false;
let _esbuildPatched = false;
let _vitePatched = false;
let _snapshotMounted = false;

let _busy = false;
let _pendingFn: (() => Promise<void>) | null = null;
let _bootstrapped = false;

const _listeners = new Set<() => void>();
function _notify() { _listeners.forEach((fn) => fn()); }
function _setStatus(s: WCStatus) { _globalStatus = s; _notify(); }
function _setUrl(u: string | null) {
  _globalUrl = u;
  _notify();
}

function _isCurrentRun(runGeneration: number, projectId: string | null): boolean {
  return runGeneration === _runGeneration && projectId === _activeProjectId;
}

function stableFallbackImage(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return PREVIEW_FALLBACK_IMAGES[hash % PREVIEW_FALLBACK_IMAGES.length];
}

function themedFallbackImage(value: string): string {
  const lower = value.toLowerCase();
  for (const [keyword, urls] of Object.entries(PREVIEW_THEMED_FALLBACK_IMAGES)) {
    if (lower.includes(keyword)) {
      let hash = 0;
      for (let i = 0; i < lower.length; i++) hash = (hash * 31 + lower.charCodeAt(i)) >>> 0;
      return urls[hash % urls.length];
    }
  }
  return stableFallbackImage(value);
}

function unwrapPreviewProxyUrl(value: string): string {
  if (!value.startsWith("/api/image?url=")) return value;
  const encoded = value.slice("/api/image?url=".length);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function isPrivatePreviewHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower === "0.0.0.0" ||
    lower === "::1" ||
    lower.startsWith("127.") ||
    lower.startsWith("10.") ||
    lower.startsWith("192.168.")
  ) {
    return true;
  }

  const match = lower.match(/^172\.(\d{1,3})\./);
  if (!match) return false;
  const second = Number(match[1]);
  return second >= 16 && second <= 31;
}

function normalizePreviewImageUrl(value: string): string {
  const raw = unwrapPreviewProxyUrl(value.trim());
  if (!raw) return themedFallbackImage("preview-empty-image");

  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase();
    const forbiddenPhrase =
      /component|layout|banner|responsive|featured|random|template|widget|section|element/.test(
        `${parsed.pathname.toLowerCase()}${parsed.search.toLowerCase()}`
      );

    if (!["http:", "https:"].includes(parsed.protocol) || isPrivatePreviewHostname(hostname)) {
      return themedFallbackImage(raw);
    }

    if (hostname === "source.unsplash.com") {
      return parsed.toString();
    }

    if (
      forbiddenPhrase ||
      hostname === "unsplash.com" ||
      hostname === "api.unsplash.com" ||
      (hostname.endsWith(".unsplash.com") && hostname !== "images.unsplash.com")
    ) {
      return themedFallbackImage(raw);
    }

    if (hostname === "images.unsplash.com") {
      if (/\/photo-[0-9a-z-]+$/i.test(parsed.pathname)) return parsed.toString();
      return themedFallbackImage(raw);
    }

    if (hostname === "images.pexels.com") {
      if (/\/photos\/\d+(?:\/|$)/i.test(parsed.pathname)) return parsed.toString();
      return themedFallbackImage(raw);
    }

    return parsed.toString();
  } catch {
    return themedFallbackImage(raw);
  }
}

function proxyPreviewImageUrl(value: string): string {
  const raw = value.trim();
  if (
    !raw ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:") ||
    raw.startsWith("./") ||
    raw.startsWith("../") ||
    (raw.startsWith("/") && !raw.startsWith("/api/image?url="))
  ) {
    return raw;
  }

  const normalized = normalizePreviewImageUrl(raw);
  if (normalized.startsWith("/api/image?url=")) return normalized;
  return `/api/image?url=${encodeURIComponent(normalized)}`;
}

function rewritePreviewSrcSet(value: string): string {
  return value
    .split(",")
    .map((entry) => {
      const trimmed = entry.trim();
      if (!trimmed) return trimmed;
      const [url, ...descriptor] = trimmed.split(/\s+/);
      return [proxyPreviewImageUrl(url), ...descriptor].join(" ").trim();
    })
    .join(", ");
}

// ─── RESET ───────────────────────────────────────────────────────────────────
export function resetContainer(projectId?: string) {
  console.log("[WC][RESET] Resetting container state for project switch");
  _runGeneration++;

  // Kill running processes
  if (_devProcess) {
    try { _devProcess.kill(); } catch { /* ignore */ }
    _devProcess = null;
  }

  // Reset state — but DO NOT touch _wcInstance or _snapshotMounted
  // The WebContainer instance persists for the entire page lifetime.
  // The snapshot (node_modules) persists across project switches.
  _activeProjectId = null;
  _globalUrl = null;
  _bootstrapped = false;
  _busy = false;
  _pendingFn = null;

  _vitePatched = false;  // Will re-patch for new project
  // NOTE: _babelPatched stays true (babel patch is universal)

  _setUrl(null);
  _setStatus("idle");

  if (projectId) {
    console.log(`[WC][RESET] Ready for project: ${projectId}`);
  }
}

// ─── SANITIZE ────────────────────────────────────────────────────────────────
function sanitizeContent(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(
      /((?:src|poster)\s*=\s*["'])([^"']+)(["'])/gi,
      (_match, prefix, url, suffix) => {
        return `${prefix}${proxyPreviewImageUrl(url)}${suffix}`;
      }
    )
    .replace(
      /((?:src|poster)\s*=\s*\{\s*["'])([^"']+)(["']\s*\})/gi,
      (_match, prefix, url, suffix) => {
        return `${prefix}${proxyPreviewImageUrl(url)}${suffix}`;
      }
    )
    .replace(/(srcSet\s*=\s*["'])([^"']+)(["'])/gi, (_match, prefix, value, suffix) => {
      return `${prefix}${rewritePreviewSrcSet(value)}${suffix}`;
    })
    .replace(/(srcSet\s*=\s*\{\s*["'])([^"']+)(["']\s*\})/gi, (_match, prefix, value, suffix) => {
      return `${prefix}${rewritePreviewSrcSet(value)}${suffix}`;
    })
    .replace(/url\((['"]?)(https?:\/\/[^'"()]+)\1\)/gi, (_match, quote, url) => {
      return `url(${quote}${proxyPreviewImageUrl(url)}${quote})`;
    })
    .replace(/[\u0000-\u0008\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200D\u2028\u2029\uFEFF]/g, "")
    .slice(0, 80_000);
}

// ─── FILE TREE ────────────────────────────────────────────────────────────────
function buildFileTree(files: AIFile[]): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const file of files) {
    const parts = file.path.replace(/^\//, "").split("/");
    let current: Record<string, unknown> = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        (current as FileSystemTree)[part] = { file: { contents: sanitizeContent(file.content) } };
      } else {
        if (!current[part]) current[part] = { directory: {} };
        current = (current[part] as { directory: Record<string, unknown> }).directory;
      }
    }
  }
  return tree;
}

function hasRequiredFiles(files: AIFile[]): boolean {
  return (
    files.some((f) => f.path === "package.json") &&
    files.some((f) => f.path === "index.html") &&
    files.some((f) => f.path === "src/main.jsx" || f.path === "src/main.tsx") &&
    files.some((f) => f.path === "src/App.jsx" || f.path === "src/App.tsx")
  );
}

// ─── OVERRIDES ───────────────────────────────────────────────────────────────
function injectPreviewRuntime(content: string): string {
  if (content.includes("__AEXON_PREVIEW_RUNTIME__")) return content;

  const runtime = `
<script>
(() => {
  if (window.__AEXON_PREVIEW_RUNTIME__) return;
  window.__AEXON_PREVIEW_RUNTIME__ = true;

  const FALLBACKS = ${JSON.stringify(PREVIEW_FALLBACK_IMAGES)};
  const FORBIDDEN = /component|layout|banner|responsive|featured|random|template|widget|section|element/i;
  const PROXY_PREFIX = '/api/image?url=';

  function stableFallback(seed) {
    const value = String(seed || 'preview-image');
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    return FALLBACKS[hash % FALLBACKS.length];
  }

  function isPrivateHost(hostname) {
    const lower = String(hostname || '').toLowerCase();
    if (
      lower === 'localhost' ||
      lower.endsWith('.localhost') ||
      lower.endsWith('.local') ||
      lower === '0.0.0.0' ||
      lower === '::1' ||
      lower.startsWith('127.') ||
      lower.startsWith('10.') ||
      lower.startsWith('192.168.')
    ) {
      return true;
    }
    const match = lower.match(/^172\\.(\\d{1,3})\\./);
    if (!match) return false;
    const second = Number(match[1]);
    return second >= 16 && second <= 31;
  }

  function normalize(raw) {
    const value = String(raw || '').trim();
    if (!value) return stableFallback('preview-empty-image');
    if (value.startsWith(PROXY_PREFIX)) return value;
    if (
      value.startsWith('data:') ||
      value.startsWith('blob:') ||
      value.startsWith('./') ||
      value.startsWith('../') ||
      value.startsWith('/')
    ) {
      return value;
    }

    try {
      const parsed = new URL(value, window.location.origin);
      const hostname = parsed.hostname.toLowerCase();
      if (!/^https?:$/.test(parsed.protocol) || isPrivateHost(hostname)) {
        return stableFallback(value);
      }
      if (hostname === 'source.unsplash.com') return parsed.toString();
      if (
        FORBIDDEN.test(parsed.pathname + parsed.search) ||
        hostname === 'unsplash.com' ||
        hostname === 'api.unsplash.com' ||
        hostname === 'pexels.com' ||
        hostname === 'www.pexels.com' ||
        (hostname.endsWith('.unsplash.com') && hostname !== 'images.unsplash.com')
      ) {
        return stableFallback(value);
      }
      if (hostname === 'images.unsplash.com' && !/\\/photo-[0-9a-z-]+$/i.test(parsed.pathname)) {
        return stableFallback(value);
      }
      if (hostname === 'images.pexels.com' && !/\\/photos\\/\\d+(?:\\/|$)/i.test(parsed.pathname)) {
        return stableFallback(value);
      }
      return parsed.toString();
    } catch {
      return stableFallback(value);
    }
  }

  function proxy(raw) {
    const normalized = normalize(raw);
    if (
      !normalized ||
      normalized.startsWith(PROXY_PREFIX) ||
      normalized.startsWith('data:') ||
      normalized.startsWith('blob:') ||
      normalized.startsWith('./') ||
      normalized.startsWith('../') ||
      (normalized.startsWith('/') && !normalized.startsWith(PROXY_PREFIX))
    ) {
      return normalized;
    }
    return PROXY_PREFIX + encodeURIComponent(normalized);
  }

  function rewriteSrcSet(value) {
    return String(value || '')
      .split(',')
      .map((entry) => {
        const trimmed = entry.trim();
        if (!trimmed) return trimmed;
        const parts = trimmed.split(/\\s+/);
        parts[0] = proxy(parts[0]);
        return parts.join(' ');
      })
      .join(', ');
  }

  function rewriteStyleValue(value) {
    return String(value || '').replace(/url\\((['"]?)([^'"()]+)\\1\\)/gi, (_match, quote, inner) => {
      return 'url(' + quote + proxy(inner) + quote + ')';
    });
  }

  function setNormalizedAttribute(element, name, value) {
    const next = String(value || '');
    if (element.getAttribute(name) !== next) {
      element.setAttribute(name, next);
    }
  }

  function patchNode(node) {
    if (!node || node.nodeType !== 1) return;
    const element = node;

    if (element.tagName === 'IMG') {
      if (!element.__aexonPreviewErrorBound) {
        element.__aexonPreviewErrorBound = true;
        element.addEventListener('error', () => {
          const next = proxy(stableFallback(element.currentSrc || element.src || element.alt || 'preview-image'));
          if (next && element.getAttribute('src') !== next) {
            setNormalizedAttribute(element, 'src', next);
          }
        });
      }
      if (element.hasAttribute('src')) {
        setNormalizedAttribute(element, 'src', proxy(element.getAttribute('src')));
      }
      if (element.hasAttribute('srcset')) {
        setNormalizedAttribute(element, 'srcset', rewriteSrcSet(element.getAttribute('srcset')));
      }
    }

    if (element.tagName === 'SOURCE' && element.hasAttribute('srcset')) {
      setNormalizedAttribute(element, 'srcset', rewriteSrcSet(element.getAttribute('srcset')));
    }

    if (element.tagName === 'VIDEO' && element.hasAttribute('poster')) {
      setNormalizedAttribute(element, 'poster', proxy(element.getAttribute('poster')));
    }

    if (element.hasAttribute('style') && element.getAttribute('style')) {
      setNormalizedAttribute(element, 'style', rewriteStyleValue(element.getAttribute('style')));
    }

    if (element.style) {
      const backgroundImage = rewriteStyleValue(element.style.backgroundImage);
      if (element.style.backgroundImage !== backgroundImage) {
        element.style.backgroundImage = backgroundImage;
      }
      const background = rewriteStyleValue(element.style.background);
      if (element.style.background !== background) {
        element.style.background = background;
      }
    }

    if (element.querySelectorAll) {
      element.querySelectorAll('img,source,video,[style]').forEach(patchNode);
    }
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.target) {
        patchNode(mutation.target);
      }
      mutation.addedNodes.forEach(patchNode);
    });
  });

  const start = () => {
    patchNode(document.documentElement);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'poster', 'style'],
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.__AEXON_PREVIEW_PROXY_IMAGE_URL__ = proxy;
})();
</script>`;

  if (/<\/head>/i.test(content)) return content.replace(/<\/head>/i, `${runtime}\n</head>`);
  if (/<body[^>]*>/i.test(content)) return content.replace(/<body([^>]*)>/i, `<body$1>${runtime}`);
  return `${runtime}\n${content}`;
}

const SANDBOX_PACKAGE_JSON = JSON.stringify(
  {
    name: "ai-project",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      dev: "node node_modules/vite/dist/node/cli.js --host --force",
      build: "node node_modules/vite/dist/node/cli.js build",
      preview: "node node_modules/vite/dist/node/cli.js preview"
    },
    dependencies: {
      react: "^18.2.0",
      "react-dom": "^18.2.0"
    },
    devDependencies: {
      vite: "4.5.3"
    }
  },
  null,
  2
);

const SANDBOX_VITE_CONFIG = `import { defineConfig } from 'vite';

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
  'https://images.unsplash.com/photo-1516321318423-f06f70504b6f',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800',
  'https://images.unsplash.com/photo-1552664730-d307ca884978',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c',
  'https://images.unsplash.com/photo-1560264357-8d9766c54b0f',
  'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37',
];

function stableFallbackFor(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return FALLBACK_IMAGES[hash % FALLBACK_IMAGES.length];
}

function hasValidUnsplashPath(pathname) {
  return pathname.startsWith('/photo-') && pathname.length > '/photo-'.length;
}

function isDigitsOnly(value) {
  if (!value) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

function hasValidPexelsPath(pathname) {
  const marker = '/photos/';
  const index = pathname.indexOf(marker);
  if (index === -1) return false;
  const suffix = pathname.slice(index + marker.length);
  const firstSlash = suffix.indexOf('/');
  const id = firstSlash === -1 ? suffix : suffix.slice(0, firstSlash);
  return isDigitsOnly(id);
}

function hasForbiddenImagePhrase(value) {
  const text = value.toLowerCase();
  return (
    text.includes('component') ||
    text.includes('layout') ||
    text.includes('banner') ||
    text.includes('responsive') ||
    text.includes('featured') ||
    text.includes('random') ||
    text.includes('template') ||
    text.includes('widget') ||
    text.includes('section') ||
    text.includes('element')
  );
}

function isPrivateHost(hostname) {
  const lower = String(hostname || '').toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.startsWith('127.') ||
    lower.startsWith('10.') ||
    lower.startsWith('192.168.')
  ) {
    return true;
  }

  const match = lower.match(/^172\\.(\\d{1,3})\\./);
  if (!match) return false;
  const second = Number(match[1]);
  return second >= 16 && second <= 31;
}

function normalizeImageTarget(target) {
  const parsed = new URL(target);
  const hostname = parsed.hostname.toLowerCase();
  const forbiddenPhrase = hasForbiddenImagePhrase(parsed.pathname + parsed.search);

  if (!['http:', 'https:'].includes(parsed.protocol) || isPrivateHost(hostname)) {
    return stableFallbackFor(target);
  }

  if (hostname === 'source.unsplash.com') {
    return parsed.toString();
  }

  if (
    forbiddenPhrase ||
    hostname === 'unsplash.com' ||
    hostname === 'api.unsplash.com' ||
    hostname === 'pexels.com' ||
    hostname === 'www.pexels.com' ||
    (hostname.endsWith('.unsplash.com') && hostname !== 'images.unsplash.com')
  ) {
    return stableFallbackFor(target);
  }

  if (hostname === 'images.unsplash.com') {
    if (hasValidUnsplashPath(parsed.pathname)) {
      return parsed.toString();
    }
    return stableFallbackFor(target);
  }

  if (hostname === 'images.pexels.com') {
    if (hasValidPexelsPath(parsed.pathname)) {
      return parsed.toString();
    }
    return stableFallbackFor(target);
  }

  return parsed.toString();
}

function fallbackSvg(label = 'Preview image') {
  const safe = String(label).replace(/[<>&"']/g, '');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#111827"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><circle cx="930" cy="170" r="180" fill="#22d3ee" opacity=".22"/><circle cx="240" cy="640" r="240" fill="#f97316" opacity=".2"/><text x="80" y="710" fill="#fff" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="700">' + safe.slice(0, 42) + '</text></svg>';
}

export default defineConfig({
  appType: 'spa',
  plugins: [
    {
      name: 'aexon-image-proxy',
      configureServer(server) {
        server.middlewares.use('/api/image', async (req, res) => {
          let target = '';
          try {
            const requestUrl = new URL(req.url || '', 'http://localhost');
            target = requestUrl.searchParams.get('url') || '';
            if (!target) {
              res.statusCode = 400;
              res.end('Missing url');
              return;
            }

            const normalizedTarget = normalizeImageTarget(target);
            const parsed = new URL(normalizedTarget);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
              res.statusCode = 400;
              res.end('Unsupported image URL');
              return;
            }

            const upstream = await fetch(parsed.toString(), {
              headers: {
                accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'user-agent': 'Mozilla/5.0 (Aexon Preview Image Proxy)',
              },
              redirect: 'follow',
            });
            if (!upstream.ok) {
              res.statusCode = 200;
              res.setHeader('content-type', 'image/svg+xml');
              res.setHeader('cache-control', 'public, max-age=86400');
              res.setHeader('access-control-allow-origin', '*');
              res.end(fallbackSvg(target));
              return;
            }

            const contentType = upstream.headers.get('content-type') || 'image/jpeg';
            if (!contentType.toLowerCase().startsWith('image/')) {
              res.statusCode = 200;
              res.setHeader('content-type', 'image/svg+xml');
              res.setHeader('cache-control', 'public, max-age=86400');
              res.setHeader('access-control-allow-origin', '*');
              res.end(fallbackSvg(target));
              return;
            }
            const bytes = new Uint8Array(await upstream.arrayBuffer());
            res.setHeader('content-type', contentType);
            res.setHeader('cache-control', 'public, max-age=86400');
            res.setHeader('access-control-allow-origin', '*');
            res.setHeader('cross-origin-resource-policy', 'cross-origin');
            res.end(bytes);
          } catch {
            res.statusCode = 200;
            res.setHeader('content-type', 'image/svg+xml');
            res.setHeader('cache-control', 'public, max-age=86400');
            res.setHeader('access-control-allow-origin', '*');
            res.end(fallbackSvg(target));
          }
        });
      },
    },
  ],
  server: {
    host: true,
    port: 5173,
    fs: { allow: ['.'] },
  },
});
`;

function applyOverrides(files: AIFile[]): AIFile[] {
  let result = files.map((f) => {
    if (f.path === "package.json") {
      // Merge user's package.json with sandbox overrides
      try {
        const userPkg = JSON.parse(f.content);
        const sandboxPkg = JSON.parse(SANDBOX_PACKAGE_JSON);
        const merged = {
          ...userPkg,
          name: sandboxPkg.name,
          private: sandboxPkg.private,
          type: sandboxPkg.type,
          scripts: sandboxPkg.scripts,
          dependencies: {
            ...userPkg.dependencies,
            ...sandboxPkg.dependencies,
          },
          devDependencies: {
            ...userPkg.devDependencies,
            ...sandboxPkg.devDependencies,
          },
        };
        delete merged.dependencies?.["@vitejs/plugin-react"];
        delete merged.devDependencies?.["@vitejs/plugin-react"];
        return { ...f, content: JSON.stringify(merged, null, 2) };
      } catch (err) {
        console.warn("[WC][OVERRIDE] Failed to parse package.json, using sandbox version", err);
        return { ...f, content: SANDBOX_PACKAGE_JSON };
      }
    }
    if (
      f.path === "vite.config.js" ||
      f.path === "vite.config.ts" ||
      f.path === "vite.config.mjs"
    ) {
      return { path: "vite.config.js", content: SANDBOX_VITE_CONFIG };
    }
    if (f.path === "index.html") {
      return { ...f, content: injectPreviewRuntime(f.content) };
    }
    return f;
  });

  result = result.filter(
    (f) => f.path !== "vite.config.ts" && f.path !== "vite.config.mjs"
  );

  if (!result.some((f) => f.path === "vite.config.js")) {
    result.push({ path: "vite.config.js", content: SANDBOX_VITE_CONFIG });
  }

  if (!result.some((f) => f.path === "src/index.css")) {
    result.push({ path: "src/index.css", content: "/* injected */\n" });
  }

  if (!result.some((f) => f.path === "index.html")) {
    result.push({
      path: "index.html",
      content: injectPreviewRuntime(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aexon Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`),
    });
  }

  result = result.map((f) => {
    if (f.path === "src/main.jsx" || f.path === "src/main.tsx") {
      const hasCss = result.some((r) => r.path === "src/index.css");
      if (!hasCss) {
        return {
          ...f,
          content: f.content
            .replace(/^import\s+["']\.\/index\.css["'];?\s*$/gm, "")
            .replace(/^import\s+["']\.\/index\.scss["'];?\s*$/gm, "")
            .replace(/^import\s+["']\.\/App\.css["'];?\s*$/gm, ""),
        };
      }
    }
    return f;
  });

  return result;
}

function collectPackageNames(files: AIFile[]): Set<string> {
  const names = new Set<string>();
  const packageFile = files.find((f) => f.path === "package.json");
  if (!packageFile) return names;

  try {
    const pkg = JSON.parse(packageFile.content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    for (const group of [pkg.dependencies, pkg.devDependencies]) {
      if (!group) continue;
      for (const name of Object.keys(group)) names.add(name);
    }
  } catch {
    return names;
  }

  return names;
}

function hasUnsupportedDependencies(files: AIFile[]): boolean {
  for (const name of collectPackageNames(files)) {
    if (!SNAPSHOT_SUPPORTED_PACKAGES.has(name)) return true;
  }
  return false;
}

async function isSnapshotReady(wc: WebContainer): Promise<boolean> {
  if (!_snapshotMounted) return false;

  for (const filePath of SNAPSHOT_REQUIRED_FILES) {
    try {
      await wc.fs.readFile(filePath);
    } catch {
      console.warn(`[WC][SNAPSHOT] Missing ${filePath}; npm install required`);
      return false;
    }
  }

  return true;
}

async function ensureSnapshotExecutables(wc: WebContainer): Promise<void> {
  for (const filePath of SNAPSHOT_EXECUTABLE_FILES) {
    try {
      await wc.fs.readFile(filePath);
    } catch {
      continue;
    }

    try {
      const chmod = await wc.spawn("chmod", ["755", filePath]);
      const exitCode = await chmod.exit;
      if (exitCode === 0) {
        console.log(`[WC][SNAPSHOT] Executable bit set: ${filePath}`);
      } else {
        console.warn(`[WC][SNAPSHOT] chmod failed (${exitCode}): ${filePath}`);
      }
    } catch (err) {
      console.warn(`[WC][SNAPSHOT] Could not chmod ${filePath}:`, err);
    }
  }
}

function shouldLogProcessChunk(chunk: string): boolean {
  const cleaned = chunk
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "")
    .trim();

  return cleaned.length > 0 && !/^[\\|/-]+$/.test(cleaned);
}

// ─── PATCHES ─────────────────────────────────────────────────────────────────

async function patchBabel(wc: WebContainer): Promise<void> {
  if (_babelPatched) return;
  const missingFile =
    "node_modules/@babel/core/lib/tools/build-external-helpers.js";
  try {
    await wc.fs.readFile(missingFile, "utf8");
    _babelPatched = true;
    return;
  } catch { /* file missing — create it */ }

  await wc.fs.mkdir("node_modules/@babel/core/lib/tools", { recursive: true });
  await wc.fs.writeFile(
    missingFile,
    `'use strict';\nmodule.exports = function buildExternalHelpers() { return ''; };\n`
  );
  _babelPatched = true;
  console.log("[WC][PATCH][babel] ✅");
}

async function patchVite(wc: WebContainer): Promise<void> {
  if (_vitePatched) return;
  const pkgPath = "node_modules/vite/package.json";

  try {
    const bytes = await wc.fs.readFile(pkgPath);
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(raw);
    } catch {
      console.warn("[WC][PATCH][vite] JSON parse failed — writing minimal replacement");
      pkg = {
        name: "vite",
        version: "4.5.3",
        type: "module",
        main: "./dist/node/index.js",
        bin: { vite: "bin/vite.js" },
        exports: {
          ".": {
            import: "./dist/node/index.js",
            require: "./index.cjs"
          },
          "./client": {
            types: "./client.d.ts"
          },
          "./package.json": "./package.json"
        }
      };
    }

    function removeNulls(obj: unknown): unknown {
      if (obj === null || obj === undefined) return undefined;
      if (Array.isArray(obj)) {
        const arr = obj.map(removeNulls).filter((v) => v !== undefined);
        return arr.length ? arr : undefined;
      }
      if (typeof obj === "object") {
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const val = removeNulls(v);
          if (val !== undefined) cleaned[k] = val;
        }
        return Object.keys(cleaned).length ? cleaned : undefined;
      }
      return obj;
    }

    const cleaned = removeNulls(pkg) as Record<string, unknown>;
    await wc.fs.writeFile(pkgPath, JSON.stringify(cleaned, null, 2));

    _vitePatched = true;
    console.log("[WC][PATCH][vite] ✅ package.json cleaned for Node 22");
  } catch (err) {
    console.warn("[WC][PATCH][vite] Could not patch:", err);
  }
}

// ─── DEV SERVER ──────────────────────────────────────────────────────────────

async function patchEsbuildWasm(wc: WebContainer): Promise<void> {
  const mainPath = "node_modules/esbuild/lib/main.js";
  const marker = "__AEXON_ESBUILD_WASM_PATCH__";

  try {
    let code = await wc.fs.readFile(mainPath, "utf8");
    if (code.includes(marker)) return;

    const target = "var esbuildCommandAndArgs = () => {\n";
    const patch = `${target}  // ${marker}\n  if (process.env.AEXON_ESBUILD_WASM === "1") {\n    return ["node", [path2.join(process.cwd(), "node_modules/esbuild-wasm/bin/esbuild")]];\n  }\n`;

    if (!code.includes(target)) {
      console.warn("[WC][PATCH][esbuild-wasm] Could not find launcher hook");
      return;
    }

    code = code.replace(target, patch);
    await wc.fs.writeFile(mainPath, code);
    console.log("[WC][PATCH][esbuild-wasm] ✅ using esbuild-wasm runner");
  } catch (err) {
    console.warn("[WC][PATCH][esbuild-wasm] Could not patch:", err);
  }
}

async function killDevServer() {
  if (_devProcess) {
    try { _devProcess.kill(); } catch { /* ignore */ }
    _devProcess = null;
    await new Promise<void>((r) => setTimeout(r, 600));
  }
  if (_wcInstance) {
    try { await _wcInstance.spawn("pkill", ["-f", "vite"]); } catch { /* ignore */ }
    await new Promise<void>((r) => setTimeout(r, 200));
  }
}

async function startDevServer(
  wc: WebContainer,
  isRetry = false,
  runGeneration = _runGeneration,
  projectId: string | null = _activeProjectId
): Promise<void> {
  if (!_isCurrentRun(runGeneration, projectId)) {
    console.log("[WC][SERVER] Skipping stale start request");
    return;
  }

  if (_devProcess) {
    console.log("[WC][SERVER] Already running");
    return;
  }

  console.log(`[WC][SERVER] Starting Vite${isRetry ? " (retry)" : ""}…`);
  _setStatus("starting");

  const dev = await wc.spawn("node", [
    "./node_modules/vite/dist/node/cli.js",
    "--host",
    "0.0.0.0",
    "--port",
    "5173"
  ], {
    env: {
      AEXON_ESBUILD_WASM: "1",
      ESBUILD_BINARY_PATH: "",
    },
  });

  _devProcess = dev;

  const outputLines: string[] = [];

  dev.output.pipeTo(
    new WritableStream({
      write(chunk) {
        const line = String(chunk).trim();
        console.log("[vite]", line);
        outputLines.push(line);
      },
    })
  ).catch(() => {});

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const unsub = wc.on("server-ready", (_port, rawUrl) => {
      if (settled) return;
      settled = true;

      clearTimeout(timer);
      unsub();

      if (!_isCurrentRun(runGeneration, projectId)) {
        console.log("[WC][SERVER] Ignoring stale server-ready event");
        try { dev.kill(); } catch { /* ignore */ }
        if (_devProcess === dev) _devProcess = null;
        resolve();
        return;
      }

      console.log("[WC][SERVER] ✅ Ready at", rawUrl);
      _setUrl(rawUrl);
      _setStatus("running");

      resolve();
    });

    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      unsub();

      console.error(
        "[WC][SERVER] Timeout — last output:",
        outputLines.slice(-5).join(" | ")
      );

      if (!isRetry) {
        await killDevServer();
        await startDevServer(wc, true, runGeneration, projectId);
        resolve();
      } else {
        reject(new Error("Vite failed after retry"));
      }
    }, VITE_TIMEOUT_MS);
  });
}

// ─── WRITE FILES ─────────────────────────────────────────────────────────────

async function _writeFilesToFs(files: AIFile[]) {
  if (!_wcInstance) return;
  console.log("[WC][FILES] Writing", files.length, "files");
  for (const file of files) {
    const filePath = file.path.replace(/^\//, "");
    const parts = filePath.split("/");
    if (parts.length > 1) {
      await _wcInstance.fs.mkdir(parts.slice(0, -1).join("/"), { recursive: true });
    }
    const tmp = `${filePath}.__tmp__`;
    await _wcInstance.fs.writeFile(tmp, sanitizeContent(file.content));
    await _wcInstance.fs.rename(tmp, filePath);
    console.log("[WC][FILES] ✓", filePath);
  }
}

// ─── PIPELINE ────────────────────────────────────────────────────────────────

async function _doMountAndRun(files: AIFile[], projectId: string | null = null) {
  try {
    if (projectId && _activeProjectId && projectId !== _activeProjectId) {
      console.log(`[WC][PROJECT_SWITCH] "${_activeProjectId}" → "${projectId}"`);
      // On project switch, use remount instead of full reset
      await _doRemountForce(files, projectId);
      return;
    }

    if (projectId) _activeProjectId = projectId;
    _bootstrapped = false;

    if (_globalStatus === "running" && projectId === _activeProjectId) {
      console.log("[WC][MOUNT] Same project running — skip");
      return;
    }

    if (!hasRequiredFiles(files)) {
      _setStatus("waiting-files");
      return;
    }

    const runGeneration = ++_runGeneration;
    files = applyOverrides(files);
    _setStatus("booting");

    if (_devProcess) await killDevServer();

    const wc = await getOrBootInstance();
    if (!_isCurrentRun(runGeneration, projectId)) return;

    // ── STAGE A: MOUNT SNAPSHOT ──────────────────────────────────────────────
    _setStatus("mounting");
    
    if (!_snapshotMounted) {
      try {
        console.log("[WC][SNAPSHOT] Loading snapshot…");
        const snapshotTree = await loadSnapshot();
        await wc.mount(snapshotTree);
        _snapshotMounted = true;
        console.log("[WC][SNAPSHOT] ✅ Snapshot mounted");
        await ensureSnapshotExecutables(wc);
      } catch (err) {
        console.warn("[WC][SNAPSHOT] Failed to load snapshot, proceeding with full npm install:", err);
        _snapshotMounted = false;
      }
    } else {
      console.log("[WC][SNAPSHOT] Already mounted, skipping snapshot load");
      await ensureSnapshotExecutables(wc);
    }

    // ── STAGE B: MOUNT USER FILES ────────────────────────────────────────────
    if (!_isCurrentRun(runGeneration, projectId)) return;
    await wc.mount(buildFileTree(files));
    console.log("[WC][MOUNT] User files mounted");
    if (!_isCurrentRun(runGeneration, projectId)) return;

    // Remove any stale alternate vite configs
    try { await wc.fs.rm("vite.config.ts");  } catch { /* ok */ }
    try { await wc.fs.rm("vite.config.mjs"); } catch { /* ok */ }

    // ── STAGE C: NPM INSTALL ────────────────────────────────────────────────
    const unsupportedDependencies = hasUnsupportedDependencies(files);
    const snapshotReady = await isSnapshotReady(wc);

    if (snapshotReady && !unsupportedDependencies) {
      console.log("[WC][NPM] Skipped install; using mounted snapshot dependencies");
    } else {
      if (unsupportedDependencies) {
        console.log("[WC][NPM] Project has dependencies outside snapshot; running install");
      }

      _setStatus("installing");

      const install = await wc.spawn("npm", [
        "install",
        "--prefer-offline",
        "--no-audit",
        "--no-fund"
      ]);

      install.output.pipeTo(
        new WritableStream({
          write(chunk) {
            const text = String(chunk);
            if (shouldLogProcessChunk(text)) console.log("[npm]", text);
          },
        })
      ).catch(() => {});

      const installExitCode = await install.exit;

      if (installExitCode !== 0) {
        throw new Error(`npm install failed with exit code ${installExitCode}`);
      }
    }

    if (!_isCurrentRun(runGeneration, projectId)) return;
    console.log("[WC][NPM] Dependency stage complete");

    // ── PATCHES (must run AFTER npm install) ─────────────────────────────────
    console.log("[WC][PATCH] Applying patches…");
    if (!_babelPatched) await patchBabel(wc);
    await patchEsbuildWasm(wc);
    await patchVite(wc);
    console.log("[WC][PATCH] ✅ All patches applied");

    // ── START DEV SERVER ─────────────────────────────────────────────────────
    if (!_devProcess) {
      await startDevServer(wc, false, runGeneration, projectId);
    }

    if (!_isCurrentRun(runGeneration, projectId)) return;
    _setStatus("running");
    console.log("[WC][PIPELINE] ✅ COMPLETE");

  } catch (err) {
    console.error("[WC][PIPELINE] ❌", err);
    _setStatus("error");
  }
}

// ─── REMOUNT ─────────────────────────────────────────────────────────────────

async function _doRemountForce(files: AIFile[], projectId: string | null = null) {
  const blockingStatuses: WCStatus[] = ["booting", "mounting", "installing", "starting"];

  if (blockingStatuses.includes(_globalStatus)) {
    console.warn(`[WC][REMOUNT] Blocked during ${_globalStatus}`);
    return;
  }

  if (!_wcInstance) {
    await _doMountAndRun(files, projectId);
    return;
  }

  if (!hasRequiredFiles(files)) {
    _setStatus("waiting-files");
    return;
  }

  files = applyOverrides(files);

  try {
    if (projectId && projectId !== _activeProjectId) {
      _activeProjectId = projectId;
    }
    const runGeneration = ++_runGeneration;

    _bootstrapped = false;
    _setStatus("restarting");
    _vitePatched = false;

    // Kill running Vite
    await killDevServer();

    // Clear user project files (but keep snapshot node_modules)
    console.log("[WC][REMOUNT] Clearing user project files…");
    try {
      await _wcInstance.fs.rm("package.json");
      await _wcInstance.fs.rm("vite.config.js");
      await _wcInstance.fs.rm("index.html");
      await _wcInstance.fs.rm("src", { recursive: true });
    } catch { /* files may not exist */ }

    // Re-mount user files
    if (!_isCurrentRun(runGeneration, projectId)) return;
    await _wcInstance.mount(buildFileTree(files));
    console.log("[WC][REMOUNT] ✅ User files remounted");

    // 🔧 FIX: Verify critical files exist after remount
    // For edits, this ensures the edited content is actually on disk
    try {
      const criticalFiles = ["src/App.jsx", "package.json", "index.html"];
      for (const filePath of criticalFiles) {
        try {
          const content = await _wcInstance.fs.readFile(filePath, "utf8");
          if (!content || content.length === 0) {
            console.warn(`[WC][REMOUNT] File exists but empty: ${filePath} — rewriting`);
            const file = files.find((f) => f.path === filePath);
            if (file) {
              await _wcInstance.fs.writeFile(filePath, sanitizeContent(file.content));
              console.log(`[WC][REMOUNT] ✅ Rewrote ${filePath}`);
            }
          } else {
            console.log(`[WC][REMOUNT] ✅ Verified ${filePath} (${content.length} bytes)`);
          }
        } catch (err) {
          console.warn(`[WC][REMOUNT] Failed to verify ${filePath}`, err);
          const file = files.find((f) => f.path === filePath);
          if (file) {
            try {
              await _wcInstance.fs.mkdir(filePath.split("/").slice(0, -1).join("/"), { recursive: true });
              await _wcInstance.fs.writeFile(filePath, sanitizeContent(file.content));
              console.log(`[WC][REMOUNT] ✅ Created missing file: ${filePath}`);
            } catch (writeErr) {
              console.error(`[WC][REMOUNT] Failed to create ${filePath}`, writeErr);
            }
          }
        }
      }
    } catch (err) {
      console.error("[WC][REMOUNT] Verification failed:", err);
    }

    // Remove any stale alternate vite configs
    try { await _wcInstance.fs.rm("vite.config.ts");  } catch { /* ok */ }
    try { await _wcInstance.fs.rm("vite.config.mjs"); } catch { /* ok */ }

    // Verify Vite CLI is still there (from snapshot)
    try {
      await _wcInstance.fs.readFile("node_modules/vite/dist/node/cli.js", "utf8");
      console.log("[WC][REMOUNT] ✅ Vite CLI verified (from snapshot)");
    } catch (err) {
      console.warn("[WC][REMOUNT] Vite CLI not found — falling back to full mount", err);
      await _doMountAndRun(files, projectId);
      return;
    }

    // Apply patches and restart Vite
    await patchEsbuildWasm(_wcInstance);
    await patchVite(_wcInstance);
    await startDevServer(_wcInstance, false, runGeneration, projectId);

  } catch (err) {
    console.error("[WC][REMOUNT]", err);
    _bootstrapped = false;
    _setStatus("error");
  }
}

async function _doWriteFiles(files: AIFile[]) {
  const blockingStatuses: WCStatus[] = ["booting", "mounting", "installing", "starting"];
  if (blockingStatuses.includes(_globalStatus)) {
    console.warn(`[WC][WRITE] Blocked during ${_globalStatus}`);
    return;
  }
  if (_bootstrapped) {
    console.warn("[WC] Ignoring write after bootstrap");
    _setStatus("running");
    return;
  }
  if (!_wcInstance) {
    await _doMountAndRun(files);
    return;
  }
  try {
    files = files.map((f) => ({ ...f, content: sanitizeContent(f.content) }));
    _setStatus("writing");
    await _writeFilesToFs(files);
    _setStatus("running");
  } catch (err) {
    console.error("[WC][WRITE]", err);
    _setStatus("error");
  }
}

// ─── EXCLUSIVE QUEUE ─────────────────────────────────────────────────────────

async function _runExclusive(fn: () => Promise<void>) {
  if (_busy) {
    _pendingFn = fn;
    return;
  }
  _busy = true;
  try {
    await fn();
  } catch (err) {
    console.error("[WC]", err);
    _setStatus("error");
  } finally {
    _busy = false;
    _notify();
    if (_pendingFn) {
      const next = _pendingFn;
      _pendingFn = null;
      _runExclusive(next);
    }
  }
}

// ─── HOOK ────────────────────────────────────────────────────────────────────

export const useWebContainer = () => {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const mountAndRun = useCallback(
    async (files: AIFile[], projectId: string | null = null) => {
      if (_globalStatus === "running" && projectId === _activeProjectId) return;
      console.log(`[WC] mountAndRun for project: ${projectId}`);
      await _runExclusive(() => _doMountAndRun(files, projectId));
    },
    []
  );

  const remount = useCallback(
    async (files: AIFile[], projectId: string | null = null) => {
      // 🔧 FIX 1: Guard against concurrent remounts
      if (_isRemounting) {
        console.log(`[WC] Remount already in progress — skipping duplicate remount for ${projectId}`);
        return;
      }

      console.log(`[WC] remount for project: ${projectId}`);
      _isRemounting = true;
      try {
        await _runExclusive(() => _doRemountForce(files, projectId));
      } finally {
        _isRemounting = false;  // Clear flag after remount completes
      }
    },
    []
  );

  const writeFiles = useCallback(async (files: AIFile[]) => {
    await _runExclusive(() => _doWriteFiles(files));
  }, []);

  return {
    status: _globalStatus,
    url: _globalUrl,
    activeProjectId: _activeProjectId,
    isRunning: _globalStatus === "running",
    isInstalled: _wcInstance !== null,
    mountAndRun,
    remount,
    writeFiles,
  };
};
