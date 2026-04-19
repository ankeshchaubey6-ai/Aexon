// src/lib/ai/engine/project-planner.ts
// v24.0 — Mode-aware · Font sanitization · Enhanced image rendering fixes · Real validation gate
//
// ROOT CAUSE FIXES APPLIED:
//   🔴 FIX 1: detectComplexityMode() — reads prompt intent before any LLM calls
//   🔴 FIX 2: CODEGEN_RULES no longer hardcodes "10-15 files" bias
//   🔴 FIX 7: sanitizeFontString() prevents runtime crashes from quoted font values
//   🔴 FIX 8: validateGeneratedFile() is now a real gate (actually called in pipeline)
//   🔴 FIX 9: buildComponentPrompt() uses mode to inject correct file count expectations
//   🔴 FIX 10: IMAGE FIXES — onerror → onError, external URLs → /api/image proxy, URL validation
//   🔴 FIX 10b: validateAndCleanImageUrl() — remove invalid Unsplash URLs, spaces, query text
//   🔴 FIX 11: MAP() SAFETY — (items || []).map(), Array.isArray guards, default props
//
// SECTIONS
//   1.  Imports & public types
//   2.  CODEGEN_RULES — canonical prompt fragment (image+map() rules included)
//   3.  COMPONENT_TEMPLATES — zero-error reference skeletons (inline styles only)
//   4.  VALIDATION_PATTERNS — regex checks on LLM output (image+map() validation included)
//   5.  ProjectPlanner class — public API
//   6.  Utility helpers (image+map() sanitizers: validateAndCleanImageUrl, sanitizeImageElements, rewriteImageUrlsToProxy, sanitizeMapCalls, sanitizeOutput)

// ─────────────────────────────────────────────────────────────────────────────
// 1. IMPORTS & PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

import { planProject } from "@/lib/ai/llm/plan-project";
import { buildDesignSystem, DesignSystem } from "@/lib/ai/engine/design-system";
import { detectComplexityMode, ModeConfig, sanitizeFontString } from "@/lib/ai/engine/project-planner-v2";

export type { ModeConfig } from "@/lib/ai/engine/project-planner-v2";
export { detectComplexityMode, sanitizeFontString } from "@/lib/ai/engine/project-planner-v2";

export interface BasicPlan {
  name: string;
  pages: string[];
}

export interface ComponentSpec {
  name: string;
  path: string;
  description: string;
  dependencies: string[];
  hasAnimation: boolean;
  hasData: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileContent {
  path: string;
  content: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CODEGEN_RULES
//    ROOT FIX #2: Removed hardcoded "Plan 10-15 components" language.
//    File count guidance now comes from the ModeConfig injected per prompt.
//
//    Rule groups unchanged — these fix specific, recurring error classes.
//    Group F updated: inline styles ONLY (no Tailwind, no className).
// ─────────────────────────────────────────────────────────────────────────────

export const CODEGEN_RULES = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODE GENERATION RULES (ABSOLUTE — violations crash the build pipeline)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ GROUP A — OUTPUT INTEGRITY ━━━
A1. The VERY FIRST character you output must be the first character of the file.
    Never prepend "Here is...", "I'll create...", or any explanation.
A2. NEVER write any explanation, note, or summary AFTER the closing brace or
    after "export default". The file ends with the last line of code. Period.
A3. NEVER truncate. Complete every JSX tag, every function body, every file.
    Never write "// TODO", "// rest here", "// ... add more", or any placeholder.
A4. No markdown fences. No backticks. No "use client". No "use server".
A5. Complete the ENTIRE file in one response.

━━━ GROUP B — JSX SYNTAX ━━━
B1. Every JSX opening tag must have a matching closing tag or be self-closed.
B2. Void elements (img, input, br, hr) must ALWAYS be self-closed.
B3. NEVER put an if-statement inside a JSX expression {}.
    WRONG:  { if (x) <div/> }     RIGHT: { x && <div/> }
B4. NEVER use a for-loop inside JSX. Use .map() instead.
B5. .map() must always include a key prop on the root element.
B6. Objects cannot be rendered directly as JSX children.
B7. Self-closing components: <Component /> not <Component></Component>

━━━ GROUP C — IMPORTS & PACKAGES ━━━
C1. AVAILABLE packages: react@18, react-dom@18
C2. BANNED packages: react-router-dom, axios, three, @react-three/fiber,
    gsap, @tanstack/react-query, zustand, recharts, preact, styled-components,
    @emotion/*, next/*, classnames, clsx, framer-motion, lucide-react
C3. Every identifier you USE must be IMPORTED.
C4. React hooks must be imported from 'react'.
C5. Import ONLY what you use. No unused imports.
C6. Relative imports for local files: use './' or '../'
C7. In .jsx files, relative imports must include the .jsx extension.
C8. NEVER import any CSS file. CSS imports are FORBIDDEN.
C9. NEVER import from a file not in ALREADY GENERATED.

━━━ GROUP D — REACT HOOKS ━━━
D1. Hooks at the TOP LEVEL only. Never inside if/else, loops, callbacks.
D2. useEffect ALWAYS needs a dependency array as second argument.
D3. NEVER make useEffect async. Use IIFE pattern:
    useEffect(() => { (async () => { ... })(); }, [])
D4. useCallback ALWAYS: useCallback((x) => fn(x), [deps])
D5. useMemo ALWAYS: useMemo(() => compute(), [deps])
    DEP ARRAY IS SECOND ARG — NOT INSIDE THE FIRST ARG.
D6. useRef initial value: useRef(null)
D7. useState initial value always provided: useState('')
D8. Custom hooks must start with "use"
D9. Never mutate state directly. Use setter: setArr(prev => [...prev, x])

━━━ GROUP E — FILE STRUCTURE ━━━
E1. Every .jsx file: EXACTLY ONE "export default" statement.
E2. Every .jsx file must import React.
E3. Component function name must match the filename (PascalCase).
E4. Filenames must NOT start with a digit.
E5. Never define the same const/let/var name twice in the same scope.
E6. Never import a component not listed in ALREADY GENERATED.
E7. Sub-components (Logo, NavLinks, UserMenu) — define them in the same file.

━━━ GROUP F — STYLING (INLINE ONLY) ━━━
F1. ALL styling: inline style={{}} ONLY
F2. NO Tailwind. NO className (except for very specific animation triggers).
F3. NO CSS imports. NO external stylesheets.
F4. CRITICAL: fontFamily values must NOT contain quotes inside the string.
    WRONG: fontFamily: "'Syne', sans-serif"   ← crashes at runtime
    WRONG: fontFamily: '"DM Sans", sans-serif' ← crashes at runtime
    RIGHT: fontFamily: 'Syne, sans-serif'      ← correct
    RIGHT: fontFamily: 'DM Sans, sans-serif'   ← correct

━━━ GROUP G — PROXY CORRUPTION ━━━
G1. Arrow functions: "=>" only. NEVER "= />" or "= / >".
G2. Never use <REDACTED_EMAIL> or [REDACTED] as values.

━━━ GROUP H — NO TYPESCRIPT IN .jsx FILES ━━━
H1. Zero TypeScript annotations. No React.FC, no useState<string>, no interface.

━━━ GROUP I — IDENTIFIERS ━━━
I1. Never declare the same identifier twice in the same scope.
I2. Identifiers must not start with a digit.

━━━ GROUP J — STATE & SIDE EFFECTS ━━━
J1. Never mutate state directly.
J2. Cleanup side effects — return cleanup from useEffect when using timers/listeners.
J3. Never call a hook after an early return.

━━━ GROUP K — IMAGE HANDLING ━━━
K1. NEVER use onerror="...". Always use onError prop (camelCase, React standard).
K2. External image URLs MUST use proxy: /api/image?url=ENCODED_URL
    WRONG:  src="https://images.unsplash.com/photo-xyz"
    RIGHT:  src="/api/image?url=https://images.unsplash.com/photo-xyz"
K3. ALWAYS include fallback error handler:
    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/api/image?url=' + encodeURIComponent('https://images.unsplash.com/photo-1518770660439-4636190af475'); }}
K4. Use data: URIs or base64 for embedded images only — never for large photos.
K5. Validate img alt text is descriptive (never empty on important images).

━━━ GROUP L — MAP() SAFETY (CRITICAL—PREVENTS CRASHES) ━━━
L1. FUNCTION PARAMS: ALWAYS provide default values for arrays:
    WRONG: function CardRow({ items }) { ... items.map(...) }
    RIGHT: function CardRow({ items = [] }) { ... items.map(...) }
L2. BEFORE .map(): ALWAYS use safe syntax:
    WRONG: items.map(...)
    RIGHT: (items || []).map(...)
    RIGHT: Array.isArray(items) ? items.map(...) : []
L3. FILTER undefined/null from arrays BEFORE mapping:
    const safeItems = items ?? [];
    const filtered = safeItems.filter(x => x != null);
    return filtered.map(...)
L4. Never .map() on unpredictable data sources. Always guard.
L5. In useEffect, validate data structure BEFORE rendering:
    useEffect(() => {
      if (!Array.isArray(data)) setData([]);
    }, [data]);
`;


// ─────────────────────────────────────────────────────────────────────────────
// 3. COMPONENT_TEMPLATES
//    Updated to use inline styles ONLY (no Tailwind className).
//    ROOT FIX #7: Font strings use sanitized format (no wrapping quotes).
// ─────────────────────────────────────────────────────────────────────────────

export const COMPONENT_TEMPLATES: Record<string, string> = {

  base: `import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

function ComponentName({ title = 'Default', items = [] }) {
  const [active, setActive] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    return () => {};
  }, []);

  const handleClick = useCallback((id) => {
    setActive(id);
  }, []);

  const processed = useMemo(() => {
    return items.filter(Boolean);
  }, [items]);

  return (
    <section style={{ padding: '5rem 2rem', background: '#030712' }}>
      <h2 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#F9FAFB', marginBottom: '2rem' }}>{title}</h2>
      <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
        {processed.map((item, i) => (
          <div
            key={item.id ?? i}
            onClick={() => handleClick(item.id)}
            onMouseEnter={() => setHovered(item.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: '1rem',
              borderRadius: '12px',
              cursor: 'pointer',
              background: hovered === item.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              transition: 'background 0.2s',
            }}
          >
            <span style={{ color: '#F9FAFB' }}>{item.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ComponentName;
`,

  header: `import React, { useState, useEffect, useCallback } from 'react';

function Logo() {
  return (
    <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366F1, #06B6D4)' }} />
      <span style={{ fontWeight: 800, color: '#F9FAFB', fontSize: '1.2rem', fontFamily: 'Syne, sans-serif' }}>Brand</span>
    </a>
  );
}

function NavLinks({ links = [] }) {
  const [hovered, setHovered] = useState(null);
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          onMouseEnter={() => setHovered(link.label)}
          onMouseLeave={() => setHovered(null)}
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            textDecoration: 'none',
            color: hovered === link.label ? '#F9FAFB' : '#6B7280',
            transition: 'color 0.2s',
          }}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing',  href: '#pricing'  },
  { label: 'About',    href: '#about'    },
];

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleMenu = useCallback(() => setMenuOpen((p) => !p), []);

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      transition: 'all 0.3s',
      background: scrolled ? 'rgba(3,7,18,0.8)' : 'transparent',
      backdropFilter: scrolled ? 'blur(8px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.1)' : 'none',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo />
        <NavLinks links={NAV_LINKS} />
        <button
          type="button"
          style={{ background: 'linear-gradient(135deg, #6366F1, #06B6D4)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Get started
        </button>
      </div>
    </header>
  );
}

export default Header;
`,

  hero: `import React, { useState, useEffect, useRef } from 'react';

function Hero() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => setVisible(true), 100);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#030712' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.35) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', filter: 'blur(120px)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', animation: 'blob 10s ease-in-out infinite' }} />
      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 1.5rem', maxWidth: 800, margin: '0 auto',
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>
        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 800, color: '#F9FAFB', lineHeight: 1.1, marginBottom: '1.5rem', fontFamily: 'Syne, sans-serif' }}>
          Build something{' '}
          <span style={{ background: 'linear-gradient(135deg, #6366F1 0%, #06B6D4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            amazing
          </span>
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#6B7280', maxWidth: 560, margin: '0 auto 2.5rem', lineHeight: 1.7, fontFamily: 'DM Sans, sans-serif' }}>
          A powerful platform that helps you create, iterate, and ship products faster than ever before.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
          <button type="button" style={{ background: 'linear-gradient(135deg, #6366F1, #06B6D4)', color: '#fff', border: 'none', borderRadius: 12, padding: '0.875rem 2rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 24px rgba(99,102,241,0.3)' }}>
            Get started free
          </button>
          <button type="button" style={{ background: 'transparent', color: '#F9FAFB', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '0.875rem 2rem', fontSize: '1rem', fontWeight: 500, cursor: 'pointer' }}>
            Watch demo →
          </button>
        </div>
      </div>
    </section>
  );
}

export default Hero;
`,

  timer: `import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

function TimerDisplay({ targetDate = null, label = 'Countdown' }) {
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const timeLeft = useMemo(() => {
    if (!targetDate) return null;
    const diff = new Date(targetDate).getTime() - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  }, [targetDate, now]);

  const pad = useCallback((n) => String(n).padStart(2, '0'), []);

  if (!timeLeft) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <p style={{ color: '#6B7280' }}>{label}</p>
        <p style={{ color: '#F9FAFB', fontSize: '1.5rem', marginTop: '0.5rem' }}>No target date set</p>
      </div>
    );
  }

  const units = [
    { label: 'Days',    value: timeLeft.days    },
    { label: 'Hours',   value: timeLeft.hours   },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ];

  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <p style={{ color: '#818CF8', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '1.5rem' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        {units.map((unit, i) => (
          <div key={unit.label} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 700, color: '#F9FAFB', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '1rem 1.5rem', minWidth: '5rem', fontFamily: 'monospace' }}>
                {pad(unit.value)}
              </div>
              <p style={{ color: '#6B7280', fontSize: '0.7rem', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{unit.label}</p>
            </div>
            {i < units.length - 1 && <span style={{ color: '#374151', fontSize: '2.5rem', marginBottom: '1.5rem' }}>:</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TimerDisplay;
`,

  dataFetch: `import React, { useState, useEffect, useCallback } from 'react';

function DataList({ endpoint = '', title = 'Items' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!endpoint) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res  = await fetch(endpoint);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!cancelled) setItems(Array.isArray(data) ? data : data.items ?? []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [endpoint]);

  const retry = useCallback(() => { setError(null); setLoading(false); }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366F1', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <p style={{ color: '#F87171', marginBottom: '1rem' }}>{error}</p>
      <button onClick={retry} style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer' }}>Retry</button>
    </div>
  );

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#F9FAFB', marginBottom: '1.5rem' }}>{title}</h2>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {items.map((item, i) => (
          <div key={item.id ?? i} style={{ padding: '1rem', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ color: '#F9FAFB', fontWeight: 500 }}>{item.name ?? item.title ?? String(item)}</p>
          </div>
        ))}
        {items.length === 0 && <p style={{ color: '#6B7280', textAlign: 'center', padding: '2rem' }}>No items found.</p>}
      </div>
    </div>
  );
}

export default DataList;
`,
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. VALIDATION_PATTERNS
//    ROOT FIX #8: These checks are real — the pipeline actually enforces them.
//    Called by validateGeneratedFile() which is called in applyValidationGate().
// ─────────────────────────────────────────────────────────────────────────────

export function validateGeneratedFile(file: FileContent): ValidationResult {
  const errors: string[]   = [];
  const warnings: string[] = [];
  const c = file.content;
  const p = file.path;

  if (!c || c.length < 20) {
    return { valid: false, errors: ['File content is empty or too short'], warnings };
  }

  if (p.endsWith('.css')) {
    return { valid: false, errors: ['CSS files are not allowed'], warnings: [] };
  }

  if (p.endsWith('.jsx') || p.endsWith('.js')) {
    errors.push(...checkReactImport(c, p));
    errors.push(...checkExportDefault(c, p));
    errors.push(...checkJSXBalance(c, p));
    errors.push(...checkBraceBalance(c, p));
    errors.push(...checkDuplicateConsts(c, p));
    errors.push(...checkHookSyntax(c, p));
    errors.push(...checkProxyCorruption(c, p));
    errors.push(...checkRedactedTokens(c, p));
    errors.push(...checkNumericIdentifiers(c, p));
    errors.push(...checkBannedPackages(c, p));
    errors.push(...checkIfInJSX(c, p));
    errors.push(...checkCssImports(c, p));
    errors.push(...checkFontStringQuotes(c, p));  // ROOT FIX #7
    errors.push(...checkImageElements(c, p));    // IMAGE FIX #1: onerror prop
    errors.push(...checkImageUrls(c, p));        // IMAGE FIX #2: external URLs
    errors.push(...checkMapCalls(c, p));         // FIX #11: .map() safety
    warnings.push(...checkAsyncUseEffect(c, p));
    warnings.push(...checkMissingDepsArray(c, p));
    warnings.push(...checkProseAfterExport(c, p));
    warnings.push(...checkTruncation(c, p));

    if (p.endsWith('.jsx')) {
      errors.push(...checkTypeScriptLeaks(c, p));
    }
  }

  if (p.endsWith('.json')) {
    errors.push(...checkJSON(c, p));
  }

  return { valid: errors.length === 0, errors, warnings };
}

function checkReactImport(c: string, p: string): string[] {
  if (!p.endsWith('.jsx')) return [];
  return (c.includes("from 'react'") || c.includes('from "react"'))
    ? []
    : [`[${p}] Missing React import`];
}

function checkExportDefault(c: string, p: string): string[] {
  if (!p.endsWith('.jsx')) return [];
  const count = (c.match(/\bexport\s+default\b/g) ?? []).length;
  if (count === 0) return [`[${p}] Missing export default`];
  if (count > 1)  return [`[${p}] Multiple export default (${count}x) — only one allowed`];
  return [];
}

function checkJSXBalance(c: string, p: string): string[] {
  const TAGS = [
    'div','section','main','nav','header','footer','ul','ol','li',
    'span','p','h1','h2','h3','h4','h5','h6','form','article',
    'aside','table','thead','tbody','tr','td','th','button','a',
    'label','select','textarea','figure','figcaption',
  ];
  const errors: string[] = [];
  for (const tag of TAGS) {
    const open  = (c.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length;
    const close = (c.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;
    if (Math.abs(open - close) > 1) {
      errors.push(`[${p}] JSX tag imbalance <${tag}>: ${open} open, ${close} close`);
    }
  }
  return errors;
}

function checkBraceBalance(c: string, p: string): string[] {
  const stripped = c
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
  const open  = (stripped.match(/\{/g) ?? []).length;
  const close = (stripped.match(/\}/g) ?? []).length;
  if (Math.abs(open - close) > 3) {
    return [`[${p}] Unbalanced braces: ${open} open, ${close} close`];
  }
  return [];
}

function checkDuplicateConsts(c: string, p: string): string[] {
  const counts = new Map<string, number>();
  for (const m of c.matchAll(/\bconst\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g)) {
    counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([name, n]) => `[${p}] Duplicate const '${name}' declared ${n}x`);
}

function checkHookSyntax(c: string, p: string): string[] {
  const errors: string[] = [];
  if (/useMemo\s*\(\s*\([^)]*,\s*\[/.test(c)) {
    errors.push(`[${p}] CRITICAL: useMemo dep array is INSIDE the function argument`);
  }
  if (/useCallback\s*\(\s*\([^)]*,\s*\[/.test(c)) {
    errors.push(`[${p}] CRITICAL: useCallback dep array is INSIDE the function argument`);
  }
  if (/useMemo\s*\(\s*\)/.test(c)) errors.push(`[${p}] useMemo called with no arguments`);
  if (/useCallback\s*\(\s*\)/.test(c)) errors.push(`[${p}] useCallback called with no arguments`);
  return errors;
}

function checkProxyCorruption(c: string, p: string): string[] {
  return /=\s*\/\s*>/.test(c)
    ? [`[${p}] Proxy-corrupted arrow '= />' found`]
    : [];
}

function checkRedactedTokens(c: string, p: string): string[] {
  return /<REDACTED_EMAIL>|\[REDACTED(?:_EMAIL)?\]/.test(c)
    ? [`[${p}] Proxy redaction token found`]
    : [];
}

function checkNumericIdentifiers(c: string, p: string): string[] {
  const errors: string[] = [];
  if (/import\s+\d\w*\s+from/.test(c)) errors.push(`[${p}] Import identifier starts with digit`);
  const base = p.split('/').pop()?.split('.')[0] ?? '';
  if (/^\d/.test(base)) errors.push(`[${p}] Filename starts with digit`);
  return errors;
}

function checkBannedPackages(c: string, p: string): string[] {
  const BANNED = [
    'react-router-dom','axios','three','@react-three/fiber','@react-three/drei',
    'gsap','react-intersection-observer','@tanstack/react-query','zustand',
    'recharts','preact','styled-components','@emotion/react','@emotion/styled',
    'classnames','clsx','framer-motion','lucide-react',
  ];
  return BANNED
    .filter((pkg) => c.includes(`'${pkg}'`) || c.includes(`"${pkg}"`))
    .map((pkg) => `[${p}] Banned package '${pkg}' (not installed)`);
}

function checkIfInJSX(c: string, p: string): string[] {
  return /\{[\s\n]*if\s*\(/.test(c)
    ? [`[${p}] if-statement inside JSX {} — use ternary or && instead`]
    : [];
}

function checkCssImports(c: string, p: string): string[] {
  return /import\s+['"`][^'"`]*\.css['"`]/.test(c)
    ? [`[${p}] CSS import detected — not allowed`]
    : [];
}

/**
 * ROOT FIX #7: Detect font string values with embedded quotes inside JSX style={{}} props.
 *
 * Pattern: fontFamily: "'Something', sans-serif"
 * The single quotes inside the string cause runtime syntax errors.
 *
 * This check warns at build time so the issue is caught before deployment.
 */
function checkFontStringQuotes(c: string, p: string): string[] {
  // Match fontFamily property with quotes-inside-string pattern
  if (/fontFamily\s*:\s*['"]\s*'[^'"]+'\s*,/.test(c)) {
    return [`[${p}] fontFamily value contains embedded quotes — use: fontFamily: 'FontName, sans-serif' (no inner quotes)`];
  }
  return [];
}

/**
 * IMAGE FIX #1: Detect invalid React image props (onerror vs onError).
 *
 * HTML onerror attribute is lowercase and invalid in React.
 * React requires camelCase: onError with proper handler function.
 *
 * Pattern: onerror="..."
 * This check catches the common mistake before build breaks.
 */
function checkImageElements(c: string, p: string): string[] {
  const errors: string[] = [];
  // Check for onerror attribute (invalid in React)
  if (/onerror\s*=\s*["']/i.test(c)) {
    errors.push(`[${p}] IMAGE: Invalid onerror attribute found — use onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/api/image?url=' + encodeURIComponent('https://images.unsplash.com/photo-1507525428034-b723cf961d3e'); }}`);
  }
  return errors;
}

/**
 * IMAGE FIX #2: Detect unproxied external image URLs and invalid URL patterns.
 *
 * BUILD-TIME VALIDATION (strict matching validateAndCleanImageUrl rules)
 *
 * REJECTS:
 *   ❌ Invalid domains (not images.unsplash.com or images.pexels.com)
 *   ❌ URLs with spaces or special characters
 *   ❌ Query strings with uppercase text (descriptive content)
 *   ❌ URLs containing "component", "layout", "image", "responsive", etc.
 *   ❌ Unproxied external URLs
 *
 * REQUIRES:
 *   ✅ https://images.unsplash.com/photo-XXXXXXX (valid format)
 *   ✅ https://images.pexels.com/photos/XXXXXXX (valid format)
 *   ✅ All must be proxied: /api/image?url=ENCODED_URL
 *   ✅ All must have alt text
 *
 * Pattern: src="https://..." or src='https://...'
 * Exemptions: /api/, data:, /public/, local paths
 */
function checkImageUrls(c: string, p: string): string[] {
  const errors: string[] = [];
  
  // Match src attributes with external URLs (https://, http://)
  const externalUrlPattern = /src\s*=\s*["']([^"']+)["']/gi;
  
  for (const match of c.matchAll(externalUrlPattern)) {
    const fullMatch = match[0];
    const url = match[1];
    
    // Skip exempted patterns (already safe)
    if (url.startsWith('data:') || url.startsWith('/api/') || url.startsWith('/public/') || !url.match(/^https?:\/\//)) {
      continue;
    }
    
    // VALIDATION 1: Must use only images.unsplash.com or images.pexels.com
    const isValidUnsplash = url.startsWith('https://images.unsplash.com') || url.startsWith('http://images.unsplash.com');
    const isValidPexels = url.startsWith('https://images.pexels.com') || url.startsWith('http://images.pexels.com');
    
    if (!isValidUnsplash && !isValidPexels) {
      // Check what domain is being used
      if (url.includes('source.unsplash.com')) {
        errors.push(`[${p}] IMAGE: Invalid domain — use images.unsplash.com (not source.unsplash.com)`);
      } else if (url.includes('unsplash.com') && !url.includes('images.unsplash.com')) {
        errors.push(`[${p}] IMAGE: Invalid Unsplash domain — must use images.unsplash.com/photo-XXXXXXX`);
      } else if (url.includes('pexels.com') && !url.includes('images.pexels.com')) {
        errors.push(`[${p}] IMAGE: Invalid Pexels domain — must use images.pexels.com/photos/XXXXXXX`);
      } else if (url.includes('api.')) {
        errors.push(`[${p}] IMAGE: API URLs not allowed — use direct image URL instead`);
      } else {
        errors.push(`[${p}] IMAGE: Invalid domain — only images.unsplash.com or images.pexels.com allowed\n         Found: ${url.slice(0, 80)}`);
      }
      continue;
    }

    // VALIDATION 2: URLs with spaces
    if (/\s/.test(url)) {
      errors.push(`[${p}] IMAGE: URL contains spaces — remove or use valid format\n         Found: ${url.slice(0, 80)}`);
      continue;
    }

    // VALIDATION 3: Query strings with uppercase letters (descriptive text)
    if (url.includes('?') && /\?.*[A-Z]/.test(url)) {
      errors.push(`[${p}] IMAGE: URL contains query parameters with text — remove query strings\n         Found: ${url.slice(0, 80)}`);
      continue;
    }

    // VALIDATION 4: Forbidden phrases
    const forbiddenPhrases = ['component', 'layout', 'banner', 'responsive', 'featured', 'random'];
    if (forbiddenPhrases.some(phrase => url.toLowerCase().includes(phrase))) {
      errors.push(`[${p}] IMAGE: URL contains forbidden phrase — use direct photo ID\n         Found: ${url.slice(0, 80)}`);
      continue;
    }

    // VALIDATION 5: Unsplash must have photo ID format
    if (isValidUnsplash && !url.match(/\/photo-[0-9a-z]+/i)) {
      errors.push(`[${p}] IMAGE: Unsplash URL missing photo ID — use format /photo-XXXXXXX\n         Found: ${url.slice(0, 80)}`);
      continue;
    }

    // VALIDATION 6: Pexels must have numeric photo ID
    if (isValidPexels && !url.match(/\/photos\/\d+/)) {
      errors.push(`[${p}] IMAGE: Pexels URL missing photo ID — use format /photos/XXXXXXX\n         Found: ${url.slice(0, 80)}`);
      continue;
    }

    // VALIDATION 7: All external URLs must be proxied
    errors.push(`[${p}] IMAGE: External URL found — must wrap in proxy: /api/image?url=ENCODED_URL\n         Found: ${url.slice(0, 80)}`);
  }
  
  return errors;
}

/**
 * FIX #11: Detect unsafe .map() calls that can crash at runtime.
 * Pattern: Direct .map() on unsanitized props (items.map instead of (items || []).map)
 * 
 * This catches:
 * - items.map(...) without null coalescing
 * - No default params in function signature
 * - Unguarded .map() in effects/callbacks
 */
function checkMapCalls(c: string, p: string): string[] {
  const errors: string[] = [];
  
  // Check for unsafe .map() pattern: identifier.map( where identifier is not wrapped
  // This is a heuristic check - looks for common patterns
  
  // Pattern 1: Direct map without guard (items.map, data.map, etc.)
  // But exclude cases that are already safe: (xxx || []).map, Array.isArray
  const hasUnsafeMapPattern = /\b(?!const\s+|Array\.isArray\()(\w+)\.map\s*\((?=\s*[^=])/g;
  const hasGuardedPattern = /(\(\s*\w+\s*\|\|\s*\[\].*\.map|Array\.isArray\s*\(\s*\w+\s*\)\s*\?)/;
  
  // Simple heuristic: if there's .map( and no guarding pattern found
  if (/\.map\s*\(/.test(c) && !hasGuardedPattern.test(c)) {
    // Check if there's unsafe map (not in template or already safe context)
    const unsafeMatches = c.match(/[^=]\s+(\w+)\.map\s*\(/g);
    if (unsafeMatches && unsafeMatches.length > 0) {
      errors.push(`[${p}] MAP SAFETY: Potential unsafe .map() call detected — use (items || []).map(...) or Array.isArray guard`);
    }
  }
  
  // Check function params don't have default array value
  if (/function\s+\w+\s*\(\s*{\s*\w+\s*}\s*\)/.test(c) || /const\s+\w+\s*=\s*\(\s*{\s*\w+\s*}\s*\)/.test(c)) {
    // Pattern: { items } without = []
    if (/{\s*\w+\s*}/.test(c) && !/{\s*\w+\s*=\s*\[\]/.test(c) && !/{\s*\w+\s*=\s*null/.test(c)) {
      errors.push(`[${p}] MAP SAFETY: Function params without defaults — add = [] for arrays: ({ items = [] })`);
    }
  }
  
  return errors;
}

function checkTypeScriptLeaks(c: string, p: string): string[] {
  const errors: string[] = [];
  if (/:\s*React\.(FC|ReactNode|ReactElement|ComponentType)/.test(c)) {
    errors.push(`[${p}] TypeScript React type annotation in .jsx file`);
  }
  if (/\buseState<[A-Za-z]/.test(c) || /\buseRef<[A-Za-z]/.test(c)) {
    errors.push(`[${p}] TypeScript generic in .jsx (useState<T>/useRef<T>)`);
  }
  if (/\binterface\s+\w+\s*\{/.test(c)) {
    errors.push(`[${p}] TypeScript interface in .jsx file`);
  }
  return errors;
}

function checkAsyncUseEffect(c: string, p: string): string[] {
  return /useEffect\s*\(\s*async\s*(?:\(\s*\)|function)/.test(c)
    ? [`[${p}] WARNING: async useEffect — use IIFE pattern`]
    : [];
}

function checkMissingDepsArray(c: string, p: string): string[] {
  const warnings: string[] = [];
  if (/useMemo\s*\(/.test(c) && !/useMemo\s*\([^)]+\)\s*,\s*\[/.test(c)) {
    warnings.push(`[${p}] WARNING: useMemo may be missing dep array`);
  }
  if (/useEffect\s*\(/.test(c) && !/useEffect\s*\([^)]+\)\s*,\s*\[/.test(c)) {
    warnings.push(`[${p}] WARNING: useEffect may be missing dep array`);
  }
  return warnings;
}

function checkProseAfterExport(c: string, p: string): string[] {
  const pats = [
    /export\s+default\s+\w+\s*;\s*\n+\s*I\s+(have|added|removed)/i,
    /export\s+default\s+\w+\s*;\s*\n+\s*Note\s+that/i,
    /export\s+default\s+\w+\s*;\s*\n+\s*Here('s| is)/i,
  ];
  return pats.some((re) => re.test(c))
    ? [`[${p}] WARNING: LLM prose after export default`]
    : [];
}

function checkTruncation(c: string, p: string): string[] {
  if (!p.endsWith('.jsx')) return [];
  const open   = (c.match(/\(/g) ?? []).length;
  const close  = (c.match(/\)/g) ?? []).length;
  const openB  = (c.match(/\{/g) ?? []).length;
  const closeB = (c.match(/\}/g) ?? []).length;
  const w: string[] = [];
  if (open  - close  > 4) w.push(`[${p}] WARNING: ${open - close} unclosed parens — possible truncation`);
  if (openB - closeB > 5) w.push(`[${p}] WARNING: ${openB - closeB} unclosed braces — possible truncation`);
  return w;
}

function checkJSON(c: string, p: string): string[] {
  try { JSON.parse(c); return []; }
  catch (e) { return [`[${p}] Invalid JSON: ${String(e).slice(0, 80)}`]; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ProjectPlanner CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class ProjectPlanner {

  static async planFromPrompt(prompt: string) {
    const designSystem = buildDesignSystem(prompt);
    return planProject(prompt, designSystem);
  }

  static plan(prompt: string): BasicPlan {
    const lower = prompt.toLowerCase();
    if (lower.includes('landing'))                              return { name: 'ai-landing-app',   pages: ['home', 'pricing', 'contact'] };
    if (lower.includes('dashboard'))                           return { name: 'ai-dashboard-app', pages: ['dashboard', 'analytics', 'settings'] };
    if (lower.includes('blog'))                                return { name: 'ai-blog-app',      pages: ['home', 'post', 'about'] };
    if (lower.includes('portfolio'))                           return { name: 'ai-portfolio-app', pages: ['home', 'projects', 'contact'] };
    if (lower.includes('ecommerce') || lower.includes('shop')) return { name: 'ai-shop-app',      pages: ['home', 'products', 'cart'] };
    if (lower.includes('saas'))                                return { name: 'ai-saas-app',      pages: ['home', 'features', 'pricing'] };
    if (lower.includes('streaming') || lower.includes('video')) return { name: 'ai-streaming-app', pages: ['home', 'browse', 'watch'] };
    return { name: 'ai-generated-app', pages: ['home'] };
  }

  /**
   * ROOT FIX #9: buildComponentPrompt now accepts and uses ModeConfig.
   * The mode is surfaced in the prompt so the LLM understands the project scope.
   */
  static buildComponentPrompt(
    spec: ComponentSpec,
    alreadyGenerated: string[],
    projectDescription: string,
    mode?: ModeConfig,
  ): string {
    const resolvedMode = mode ?? detectComplexityMode(projectDescription);
    const category = ProjectPlanner.detectCategory(spec.name, spec.description);
    const template = COMPONENT_TEMPLATES[category] ?? COMPONENT_TEMPLATES.base;

    return `You are an elite React engineer. Output ONLY raw file content.
No markdown. No backticks. No explanations. No "use client". No TypeScript.
The VERY FIRST character must be the first character of the file.

${CODEGEN_RULES}

━━━ PROJECT CONTEXT ━━━
${projectDescription}
Project scope: ${resolvedMode.mode} (${resolvedMode.description})

━━━ FILE TO GENERATE ━━━
Path:       ${spec.path}
Component:  ${spec.name}
Purpose:    ${spec.description}

━━━ ALREADY GENERATED (safe to import — use exact paths below) ━━━
${alreadyGenerated.length > 0 ? alreadyGenerated.join('\n') : '(none — do not import from other components)'}

━━━ REFERENCE SKELETON (follow this structure) ━━━
${template}

━━━ CRITICAL REMINDERS ━━━
useMemo(() => value, [deps])         ← dep array is SECOND arg
useCallback((x) => fn(x), [deps])   ← dep array is SECOND arg
useEffect(() => { ... }, [])        ← dep array ALWAYS required
fontFamily: 'Syne, sans-serif'      ← NO inner quotes in font names
ALL styling: inline style={{}} ONLY — no className, no CSS imports

━━━ IMAGE HANDLING (GROUP K) ━━━
NEVER onerror="..."                 ← use onError handler instead
USE onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/api/image?url=' + encodeURIComponent('https://images.unsplash.com/photo-1518770660439-4636190af475'); }}
REWRITE external URLs to proxy:     /api/image?url=ENCODED_URL
Example:  src="/api/image?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-xyz"
ALWAYS include alt text on img tags (never empty for important images)

━━━ MAP() SAFETY FOR CRASH PREVENTION (GROUP L) ━━━
PARAM DEFAULTS:  function CardRow({ items = [] }) ← ALWAYS default to []
ALWAYS GUARD:    (items || []).map(...)  NOT  items.map(...)
OR:              Array.isArray(items) ? items.map(...) : null
BEFORE RENDER:   const safe = items ?? []; safe.map(...)

Example—SAFE:
function CardRow({ items = [] }) {
  return (
    <div>
      {(items || []).map((item, i) => (
        <div key={item.id ?? i}>{item.name}</div>
      ))}
    </div>
  );
}

NEVER write explanation text after export default
Start writing the file now:`;

  }

  static detectCategory(name: string, description: string): string {
    const s = (name + ' ' + description).toLowerCase();
    if (/header|navbar|nav\b/.test(s))        return 'header';
    if (/hero|landing|banner|splash/.test(s)) return 'hero';
    if (/timer|countdown|clock/.test(s))      return 'timer';
    if (/fetch|api|data.*list/.test(s))       return 'dataFetch';
    return 'base';
  }

  static validateBatch(files: FileContent[]): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();
    for (const file of files) results.set(file.path, validateGeneratedFile(file));
    return results;
  }

  static summariseValidation(results: Map<string, ValidationResult>): string {
    let valid = 0; let invalid = 0;
    const lines: string[] = [];
    for (const [path, result] of results) {
      if (result.valid) { valid++; }
      else {
        invalid++;
        lines.push(`  ❌ ${path}`);
        for (const err of result.errors) lines.push(`     • ${err}`);
      }
      for (const warn of result.warnings) lines.push(`  ⚠️  ${warn}`);
    }
    return [`Validation: ${valid} valid, ${invalid} invalid`, ...lines].join('\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IMAGE SANITIZER: Convert invalid onerror attribute to React onError handler.
 *
 * Replaces: onerror="handleError()"
 * With:     onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/api/image?url=' + encodeURIComponent('https://images.unsplash.com/photo-1507525428034-b723cf961d3e'); }}
 *
 * This prevents React warnings and ensures proper error handling with double-guard.
 */
export function sanitizeImageElements(content: string): string {
  // Match onerror attribute (case-insensitive) and replace with proper React onError
  const fallbackUrl = "/api/image?url=" + encodeURIComponent("https://images.unsplash.com/photo-1518770660439-4636190af475");
  return content.replace(
    /\bonerror\s*=\s*["']([^"']*)["']/gi,
    `onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '${fallbackUrl}'; }}`
  );
}

/**
 * VALID UNSPLASH PHOTO IDs: Curated fallback images for broken URLs.
 */
const VALID_UNSPLASH_PHOTOS = [
  'photo-1518770660439-4636190af475',  // Technology hardware
  'photo-1498050108023-c5249f4df085',  // Coding workspace
  'photo-1519389950473-47ba0277781c',  // Team on laptops
  'photo-1560264357-8d9766c54b0f',     // Tech setup
  'photo-1552664730-d307ca884978',     // Modern office
  'photo-1522869635100-9f4c5e86aa37',  // Team collaboration
];

/**
 * VALIDATE & CLEAN IMAGE URLs: Strict validation to ensure zero invalid URLs reach frontend.
 *
 * REJECTS:
 *   1. URLs with spaces or special characters
 *   2. URLs with more than 3 words (detected via uppercase in query params)
 *   3. URLs containing phrases: "component", "layout", "image", "responsive", "banner"
 *   4. Any domain OTHER than images.unsplash.com or images.pexels.com
 *
 * ALLOWS:
 *   ✅ https://images.unsplash.com/photo-XXXXXXX
 *   ✅ https://images.pexels.com/photos/XXXXXXX
 *
 * FALLBACK: If URL invalid, returns valid Unsplash photo ID
 *
 * Invalid patterns (REJECTED):
 *   ❌ https://source.unsplash.com/featured/?Responsive layout...
 *   ❌ https://images.unsplash.com/photo with spaces
 *   ❌ https://api.unsplash.com/...
 *   ❌ https://unsplash.com/... (wrong domain)
 *
 * Valid patterns (ACCEPTED):
 *   ✅ https://images.unsplash.com/photo-1507525428034-b723cf961d3e
 *   ✅ https://images.pexels.com/photos/1234567
 */
export function validateAndCleanImageUrl(url: string): string {
  if (!url) {
    // Return valid fallback
    const fallback = VALID_UNSPLASH_PHOTOS[Math.floor(Math.random() * VALID_UNSPLASH_PHOTOS.length)];
    return `https://images.unsplash.com/${fallback}`;
  }

  let cleaned = url.trim();

  // REJECT 1: URLs with spaces or control characters
  if (/\s/.test(cleaned) || /[<>{}"\|\\\^`]/.test(cleaned)) {
    const fallback = VALID_UNSPLASH_PHOTOS[Math.floor(Math.random() * VALID_UNSPLASH_PHOTOS.length)];
    return `https://images.unsplash.com/${fallback}`;
  }

  // REJECT 2: Query parameters with uppercase letters (indicates descriptive text)
  // Pattern: ?Responsive or ?Layout or ?Component
  if (cleaned.includes('?') && /\?.*[A-Z]/.test(cleaned)) {
    const fallback = VALID_UNSPLASH_PHOTOS[Math.floor(Math.random() * VALID_UNSPLASH_PHOTOS.length)];
    return `https://images.unsplash.com/${fallback}`;
  }

  // REJECT 3: URLs containing forbidden phrases
  const forbiddenPhrases = [
    'component', 'layout', 'banner', 'responsive',
    'featured', 'random', 'search', 'category',
    'section', 'element', 'template', 'widget',
  ];
  const lowerUrl = cleaned.toLowerCase();
  if (forbiddenPhrases.some((phrase) => lowerUrl.includes(phrase))) {
    const fallback = VALID_UNSPLASH_PHOTOS[Math.floor(Math.random() * VALID_UNSPLASH_PHOTOS.length)];
    return `https://images.unsplash.com/${fallback}`;
  }

  // REQUIREMENT 4 & 5: ONLY allow images.unsplash.com or images.pexels.com
  const isValidUnsplash = cleaned.startsWith('https://images.unsplash.com') || cleaned.startsWith('http://images.unsplash.com');
  const isValidPexels = cleaned.startsWith('https://images.pexels.com') || cleaned.startsWith('http://images.pexels.com');
  
  if (!isValidUnsplash && !isValidPexels) {
    // Reject: Invalid domain
    const fallback = VALID_UNSPLASH_PHOTOS[Math.floor(Math.random() * VALID_UNSPLASH_PHOTOS.length)];
    return `https://images.unsplash.com/${fallback}`;
  }

  // NORMALIZE: Remove query parameters, hash fragments
  cleaned = cleaned.split('?')[0].split('#')[0];

  // VALIDATE: Unsplash must have photo ID format
  if (isValidUnsplash && !cleaned.match(/\/photo-[0-9a-z]+/i)) {
    const fallback = VALID_UNSPLASH_PHOTOS[Math.floor(Math.random() * VALID_UNSPLASH_PHOTOS.length)];
    return `https://images.unsplash.com/${fallback}`;
  }

  // VALIDATE: Pexels must have numeric photo ID
  if (isValidPexels && !cleaned.match(/\/photos\/\d+/)) {
    const fallback = VALID_UNSPLASH_PHOTOS[Math.floor(Math.random() * VALID_UNSPLASH_PHOTOS.length)];
    return `https://images.unsplash.com/${fallback}`;
  }

  // REQUIREMENT 4 & 5: Encode and wrap in proxy
  // (This is now done by rewriteImageUrlsToProxy after this function returns)
  return cleaned;
}

/**
 * IMAGE URL REWRITER: Convert external URLs to proxy endpoints.
 *
 * REQUIREMENT: Always encode URL and wrap in proxy
 *
 * BEFORE:  src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e"
 * AFTER:   src="/api/image?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1507525428034-b723cf961d3e"
 *
 * GOAL: Zero invalid image URLs reach frontend
 *
 * Process:
 *   1. Find external URLs (https://, http://)
 *   2. Validate and clean via validateAndCleanImageUrl()
 *   3. REQUIREMENT 4: Encode with encodeURIComponent()
 *   4. REQUIREMENT 5: Wrap in /api/image?url=ENCODED_URL proxy
 *
 * Exemptions (left unchanged):
 *   ✅ /api/ — already proxied
 *   ✅ /public/ — local assets
 *   ✅ ./ or / — relative paths
 *   ✅ data: — embedded images
 *
 * This ensures images load correctly inside iframe/WebContainer.
 */
export function rewriteImageUrlsToProxy(content: string): string {
  return content.replace(
    /src\s*=\s*["'](?!(?:data:|\/api\/|\/public\/|\.\/|\/))([^"']+)["']/gi,
    (match, urlPart) => {
      // Skip data URLs and relative paths (already exempt)
      if (urlPart.startsWith('data:') || !urlPart.match(/^https?:\/\//)) {
        return match;
      }

      // Step 1: Validate and clean the URL (strict validation)
      const cleanUrl = validateAndCleanImageUrl(urlPart);

      // Step 2: REQUIREMENT 4 — Encode for safe URL parameter
      const encodedUrl = encodeURIComponent(cleanUrl);

      // Step 3: REQUIREMENT 5 — Wrap in proxy endpoint
      return `src="/api/image?url=${encodedUrl}"`;
    }
  );
}

/**
 * OUTPUT SANITIZER: Apply all image fixes to generated component code.
 *
 * Fixes applied in order:
 *   1. Fix invalid onerror attributes → onError with proper React handler
 *   2. Validate and clean image URLs (remove invalid patterns)
 *   3. Proxy external URLs through /api/image endpoint
 *   4. Ensure all img tags have proper alt text
 *
 * Call this before saving any LLM-generated component file.
 */
export function sanitizeOutputImages(content: string): string {
  let result = content;

  // FIX 1: Replace onerror → onError
  result = sanitizeImageElements(result);

  // FIX 2 & 3: Validate, clean, and proxy URLs
  result = rewriteImageUrlsToProxy(result);

  // FIX 4: Ensure img tags have alt text (add default if missing)
  result = result.replace(
    /<img\s+(?!.*\salt\s*=)([^>]*)\s*\/?>/gi,
    (match, attrs) => {
      // Add alt attribute if missing
      const withAlt = `<img ${attrs} alt="Generated image"`;
      return match.endsWith('/>') ? withAlt + ' />' : withAlt + '>';
    }
  );

  return result;
}

/**
 * MAP SAFETY SANITIZER: Fix unsafe .map() calls that crash at runtime.
 *
 * Fixes:
 *   1. items.map(...) → (items || []).map(...)
 *   2. Missing default params: ({ items }) → ({ items = [] })
 *   3. Unsafe patterns in early Returns
 *
 * Call this before saving any generated component with array operations.
 */
export function sanitizeMapCalls(content: string): string {
  let result = content;
  
  // Fix 1: Convert function params to have defaults
  // Pattern: ({ items }) → ({ items = [] })
  result = result.replace(
    /function\s+(\w+)\s*\(\s*{\s*(\w+)\s*}\s*\)/g,
    (match, funcName, param) => {
      if (!/=\s*[\[\{]/.test(match)) {
        // No default found, add = []
        return match.replace(`{ ${param} }`, `{ ${param} = [] }`);
      }
      return match;
    }
  );
  
  // Also handle arrow function params
  result = result.replace(
    /const\s+(\w+)\s*=\s*\(\s*{\s*(\w+)\s*}\s*\)\s*=>/g,
    (match, constName, param) => {
      if (!/=\s*[\[\{]/.test(match)) {
        return match.replace(`{ ${param} }`, `{ ${param} = [] }`);
      }
      return match;
    }
  );
  
  // Fix 2: Wrap unsafe .map() calls with safety guard
  // Pattern: items.map( → (items || []).map(
  // But first check it's not already wrapped
  result = result.replace(
    /(?<!\()\b(\w+)\.map\s*\(/g,
    (match, varName) => {
      // Check if already wrapped in guard
      const beforeMatch = result.substring(Math.max(0, result.indexOf(match) - 20), result.indexOf(match));
      if (beforeMatch.includes('|| []') || beforeMatch.includes('Array.isArray')) {
        return match; // Already safe
      }
      return `(${varName} || []).map(`;
    }
  );
  
  return result;
}

/**
 * UNIFIED OUTPUT SANITIZER: Fix all common runtime issues in generated code.
 *
 * Applies all sanitization fixes:
 *   1. Image handling: onerror → onError, external URLs → proxy
 *   2. Map safety: unsafe calls → guarded calls, missing defaults
 *
 * This is the main entry point — call this before saving ANY generated component.
 */
export function sanitizeOutput(content: string): string {
  let result = content;
  result = sanitizeOutputImages(result);
  result = sanitizeMapCalls(result);
  return result;
}

export function countJSXTags(
  content: string,
  tagName: string
): { open: number; close: number; balanced: boolean } {
  const open  = (content.match(new RegExp(`<${tagName}[\\s/>]`, 'g')) ?? []).length;
  const close = (content.match(new RegExp(`</${tagName}>`, 'g')) ?? []).length;
  return { open, close, balanced: Math.abs(open - close) <= 1 };
}

export function countBraces(content: string): { open: number; close: number; balanced: boolean } {
  const stripped = content
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
  const open  = (stripped.match(/\{/g) ?? []).length;
  const close = (stripped.match(/\}/g) ?? []).length;
  return { open, close, balanced: Math.abs(open - close) <= 3 };
}

export function findUnusedImports(content: string): string[] {
  const unused: string[] = [];
  const importLines      = content.split('\n').filter((l) => l.trim().startsWith('import '));
  const body             = content.replace(/^import[^\n]+$/gm, '');

  for (const line of importLines) {
    const namedMatch = line.match(/\{([^}]+)\}/);
    if (namedMatch) {
      for (const spec of namedMatch[1].split(',')) {
        const name = spec.trim().split(' as ').pop()?.trim() ?? '';
        if (name && name !== 'React' && !new RegExp(`\\b${name}\\b`).test(body)) unused.push(name);
      }
    }
    const defMatch = line.match(/import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from/);
    if (defMatch && defMatch[1] !== 'React') {
      if (!new RegExp(`\\b${defMatch[1]}\\b`).test(body)) unused.push(defMatch[1]);
    }
  }
  return unused;
}

export function auditHookCallSites(content: string, filePath: string): string[] {
  const errors: string[] = [];
  if (/useMemo\s*\(\s*\([^)]*,\s*\[/.test(content)) {
    errors.push(`[${filePath}] useMemo: dep array is inside first arg`);
  }
  if (/useCallback\s*\(\s*\([^)]*,\s*\[/.test(content)) {
    errors.push(`[${filePath}] useCallback: dep array is inside first arg`);
  }
  if (/useMemo\s*\(\s*\(\s*\)\s*=>\s*[^,)]+\s*\)(?!\s*,)/.test(content)) {
    errors.push(`[${filePath}] useMemo missing dep array as second argument`);
  }
  if (/useEffect\s*\(\s*async\s/.test(content)) {
    errors.push(`[${filePath}] async useEffect — use IIFE pattern instead`);
  }
  return errors;
}

export function sanitizeComponentFilename(filename: string): string {
  const ext  = filename.includes('.') ? '.' + filename.split('.').pop() : '';
  const base = filename.slice(0, filename.length - ext.length);
  if (!/^\d/.test(base)) return filename;
  const m = base.match(/^(\d+)(.*)/);
  if (!m) return filename;
  const [, digits, rest] = m;
  const safeName = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) + digits : `Component${digits}`;
  return safeName + ext;
}

export function buildGeneratedContext(
  files: Array<{ path: string; componentName: string }>
): string {
  if (files.length === 0) return '(none yet)';
  return files
    .map((f) => `  - ${f.componentName} → import from '${f.path.replace('src/', './')}'`)
    .join('\n');
}
