// ==================== FILE: src/lib/ai/engine/project-planner.ts ====================
//
// Stage 1 wrapper — delegates to the pipeline's planner AND owns every
// code-generation constraint injected into downstream LLM calls.
//
// SECTIONS
//   1.  Imports & public types
//   2.  CODEGEN_RULES  — canonical prompt fragment injected into every
//       file-generation call. Single source of truth. Edit here only.
//   3.  COMPONENT_TEMPLATES — zero-error reference skeletons the LLM
//       must follow for each component category.
//   4.  VALIDATION_PATTERNS — regex checks run on LLM output BEFORE
//       the file is written, so bad output is caught at source.
//   5.  ProjectPlanner class — public API used by the rest of the pipeline.
//   6.  Utility helpers — tag balance, brace balance, import auditor,
//       hook validator, useMemo/useCallback argument checker.
//

// ─────────────────────────────────────────────────────────────────────────────
// 1. IMPORTS & PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

import { planProject } from "@/lib/ai/llm/plan-project";
import { buildDesignSystem, DesignSystem } from "@/lib/ai/engine/design-system";

export interface BasicPlan {
  name: string;
  pages: string[];
}

export interface ComponentSpec {
  name: string;            // PascalCase, no leading digits
  path: string;            // e.g. "src/components/Hero.jsx"
  description: string;
  dependencies: string[];  // other component names this one imports
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
//    A single string injected at the top of EVERY LLM system prompt that
//    generates a file. This is what makes the difference between an LLM that
//    produces broken code and one that produces working code.
//
//    Every rule here was added to fix a specific, recurring error class:
//
//    Rule group A — Output integrity (fixes: prose after export, truncation)
//    Rule group B — JSX syntax (fixes: tag imbalance, if-in-JSX, self-closing)
//    Rule group C — Imports (fixes: missing imports, wrong packages, extensions)
//    Rule group D — Hooks (fixes: missing deps arrays, wrong useMemo syntax)
//    Rule group E — File structure (fixes: missing files, missing export default)
//    Rule group F — STYLING: TailwindCSS-based allowed (no CSS imports)
//    Rule group G — Proxy corruption (fixes: "= />", <REDACTED_EMAIL>)
//    Rule group H — TypeScript leaks (fixes: React.FC in .jsx, useState<T>)
//    Rule group I — Identifiers (fixes: numeric filenames, duplicate consts)
//    Rule group J — State & effects (fixes: async useEffect, setState mutation)
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
A5. Complete the ENTIRE file in one response. If you run out of space, close
    all open tags and braces cleanly before stopping.

━━━ GROUP B — JSX SYNTAX ━━━
B1. Every JSX opening tag must have a matching closing tag or be self-closed.
    WRONG:  <div>content          RIGHT: <div>content</div>
    WRONG:  <img src={x}>         RIGHT: <img src={x} />
B2. Void elements (img, input, br, hr, link, meta) must ALWAYS be self-closed.
    WRONG:  <img src={x}></img>   RIGHT: <img src={x} />
B3. NEVER put an if-statement inside a JSX expression {}.
    WRONG:  { if (x) <div/> }     RIGHT: { x && <div/> } or { x ? <div/> : null }
B4. NEVER use a for-loop inside JSX. Use .map() instead.
B5. When rendering a list with .map(), ALWAYS include a key prop on the root element.
    WRONG:  items.map(item => <Card />)
    RIGHT:  items.map((item, i) => <Card key={item.id ?? i} />)
B6. Objects cannot be rendered directly as JSX children.
    WRONG:  <div>{myObject}</div>   RIGHT: <div>{myObject.name}</div>
B7. Self-closing components with no children: <Component /> not <Component></Component>

━━━ GROUP C — IMPORTS & PACKAGES ━━━
C1. AVAILABLE packages (npm-installed, safe to import):
    react@18, react-dom@18
C2. BANNED packages (not installed — will cause ReferenceError at runtime):
    react-router-dom, axios, three, @react-three/fiber, @react-three/drei,
    gsap, react-intersection-observer, @tanstack/react-query, zustand, recharts,
    preact, styled-components, @emotion/*, next/*, classnames, clsx
C3. Every identifier you USE must be IMPORTED. No implicit globals.
    WRONG:  const cb = useCallback(() => {}, [])   // useCallback not imported
    RIGHT:  import React, { useCallback } from 'react';
C4. React hooks must be imported from 'react'. List every hook you use:
    import React, { useState, useEffect, useRef, useMemo, useCallback,
                     useContext, useReducer, useId, useLayoutEffect } from 'react';
C5. Import ONLY what you use. No unused imports.
C6. Relative imports for local files: use './' or '../', never absolute paths.
    WRONG:  import Hero from 'components/Hero'
    RIGHT:  import Hero from './components/Hero.jsx'
C7. In .jsx files, relative imports must include the .jsx extension.
C8. Import order: react → local components → local utils
C9. Never import from a file that does not exist. Only import components that
    are listed in the ALREADY GENERATED section of your system prompt.
C10. NEVER import any CSS file. CSS imports are FORBIDDEN.

━━━ GROUP D — REACT HOOKS ━━━
D1. Hooks must be called at the TOP LEVEL of a component. Never inside:
    if/else blocks, loops, callbacks, .then() handlers, or nested functions.
D2. useEffect ALWAYS needs a dependency array as its second argument.
    WRONG:  useEffect(() => { fetchData(); })
    RIGHT:  useEffect(() => { fetchData(); }, [])           // run once
    RIGHT:  useEffect(() => { fetchData(); }, [userId])     // run on change
D3. NEVER make the useEffect callback itself async. Use an IIFE instead.
    WRONG:  useEffect(async () => { const d = await fetch(...); }, [])
    RIGHT:  useEffect(() => { (async () => { const d = await fetch(...); })(); }, [])
D4. useCallback ALWAYS takes two arguments: the function AND a dependency array.
    WRONG:  const fn = useCallback((x) => doSomething(x))
    WRONG:  const fn = useCallback((x, []))     // dep array INSIDE args — CRASHES
    RIGHT:  const fn = useCallback((x) => doSomething(x), [])
    RIGHT:  const fn = useCallback((x) => doSomething(x, dep), [dep])
D5. useMemo ALWAYS takes two arguments: the factory function AND a dependency array.
    WRONG:  const val = useMemo((, []))          // INVALID SYNTAX — 500 error
    WRONG:  const val = useMemo(() => compute())  // missing dep array
    RIGHT:  const val = useMemo(() => compute(), [])
    RIGHT:  const val = useMemo(() => compute(x), [x])
    THE DEP ARRAY IS THE SECOND ARGUMENT TO useMemo, NOT INSIDE THE FIRST ARGUMENT.
D6. useRef initial value: useRef(null) not useRef()
D7. useState initial value must always be provided: useState('') not useState()
D8. Custom hooks must start with "use": useMyHook, not myHook.
D9. Never call setState directly with a mutation. Always use the setter:
    WRONG:  myArray.push(x); setMyArray(myArray)
    RIGHT:  setMyArray(prev => [...prev, x])

━━━ GROUP E — FILE STRUCTURE ━━━
E1. Every .jsx file must have EXACTLY ONE "export default" statement.
    WRONG:  export default Foo; ... export default Bar;   (two defaults)
    WRONG:  no export default at all
    RIGHT:  export default Foo;   (one, at the end)
E2. Every .jsx file must import React:
    import React from 'react';   OR   import React, { useState } from 'react';
E3. Component function name must match the filename (PascalCase):
    File: src/components/HeroSection.jsx  =>  function HeroSection() {}
E4. Filenames must be valid JavaScript identifiers — NEVER start with a digit.
    WRONG:  3DShowcase.jsx, 404Page.jsx, 2ColLayout.jsx
    RIGHT:  Showcase3D.jsx, NotFound.jsx, TwoColLayout.jsx
E5. Never define the same const/let/var name twice in the same scope.
    WRONG:  const handleScroll = ...; const handleScroll = ...;
    RIGHT:  Use one function with a single clear name.
E6. Never import a component that is used but not defined or generated yet.
    If you need NavLinks, Logo, or UserMenu — define them in the same file.
E7. If a component uses sub-components (Logo, NavLinks, UserMenu), EITHER:
    a) Define them as named functions in the same file, OR
    b) Import them from a file listed in ALREADY GENERATED.
    NEVER import from a file that does not exist.

━━━ GROUP F — STYLING (TAILWIND + MODERN UI) ━━━
F1. Use TailwindCSS via className for styling
F2. Inline styles allowed only for dynamic values only
F3. NEVER import CSS files
F4. NEVER use external stylesheets

━━━ GROUP G — PROXY CORRUPTION ━━━
G1. Arrow functions use "=>" — never "= />" or "= / >".
    WRONG:  onChange={(e) = /> setVal(e.target.value)}
    RIGHT:  onChange={(e) => setVal(e.target.value)}
G2. Never use <REDACTED_EMAIL> or [REDACTED] as values. Use '' or null.

━━━ GROUP H — NO TYPESCRIPT IN .jsx FILES ━━━
H1. .jsx files must contain ZERO TypeScript annotations:
    WRONG:  function Foo(): React.ReactElement {}  WRONG:  const Foo: React.FC = () => {}
    WRONG:  useState<string>('')                   WRONG:  interface FooProps {}
    RIGHT:  function Foo() {}                      RIGHT:  const Foo = () => {}
    RIGHT:  useState('')
H2. No TypeScript generics anywhere in .jsx: no <T>, no Array<string>, no Record<K,V>

━━━ GROUP I — IDENTIFIERS & DECLARATIONS ━━━
I1. Never declare the same identifier twice in the same scope with const/let/var.
I2. Identifiers must not start with a digit.
    WRONG:  const 3DScene = ...    RIGHT:  const Scene3D = ...
I3. Common typos that break builds — never write these:
    handlleScroll, scrolllTo, userState, useEffekt, useCallbakc, classname, onclick
I4. Do not declare variables you never use.
I5. useCallback and useMemo return values should be assigned to const.

━━━ GROUP J — STATE & SIDE EFFECTS ━━━
J1. Never mutate state directly:
    WRONG:  myList.push(x); setMyList(myList)
    RIGHT:  setMyList(prev => [...prev, x])
J2. Cleanup side effects — if useEffect starts a timer or listener, return cleanup:
    useEffect(() => {
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }, []);
J3. Never call a hook after an early return:
    WRONG:  if (!user) return null; const [x, setX] = useState(0);
    RIGHT:  const [x, setX] = useState(0); if (!user) return null;
`;

// ─────────────────────────────────────────────────────────────────────────────
// 3. COMPONENT_TEMPLATES
//    Reference skeletons injected into the LLM prompt when generating a
//    component of the matching category. Dramatically reduces hallucination.
//    Templates updated to use TailwindCSS classes.
// ─────────────────────────────────────────────────────────────────────────────

export const COMPONENT_TEMPLATES: Record<string, string> = {

  base: `import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

function ComponentName({ title = 'Default', items = [] }) {
  const [active, setActive] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    // side effects here
    return () => { /* cleanup */ };
  }, []); // dep array REQUIRED

  const handleClick = useCallback((id) => {
    setActive(id);
  }, []); // dep array is SECOND arg to useCallback

  const processed = useMemo(() => {
    return items.filter(Boolean);
  }, [items]); // dep array is SECOND arg to useMemo — NOT inside first arg

  return (
    <section className="py-20 px-6">
      <h2 className="text-4xl font-bold text-white mb-8">{title}</h2>
      <div className="grid gap-4 mt-8">
        {processed.map((item, i) => (
          <div
            key={item.id ?? i}
            onClick={() => handleClick(item.id)}
            onMouseEnter={() => setHovered(item.id)}
            onMouseLeave={() => setHovered(null)}
            className={\`p-4 rounded-xl cursor-pointer transition-colors \${
              hovered === item.id ? 'bg-white/10' : 'bg-white/5'
            } border border-white/10\`}
          >
            <span className="text-white">{item.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ComponentName;
`,

  header: `import React, { useState, useEffect, useCallback } from 'react';

// Sub-components defined IN THIS FILE — no missing import errors
function Logo() {
  return (
    <a href="/" className="flex items-center gap-2 no-underline">
      <div className="w-8 h-8 rounded-lg bg-indigo-500" />
      <span className="font-bold text-white text-lg">Brand</span>
    </a>
  );
}

function NavLinks({ links = [] }) {
  const [hoveredLink, setHoveredLink] = useState(null);
  return (
    <nav className="flex items-center gap-6">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          onMouseEnter={() => setHoveredLink(link.label)}
          onMouseLeave={() => setHoveredLink(null)}
          className={\`text-sm font-medium no-underline transition-colors \${
            hoveredLink === link.label ? 'text-white' : 'text-gray-400'
          }\`}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

function UserMenu({ isLoggedIn = false }) {
  return (
    <div className="flex items-center gap-3">
      {isLoggedIn ? (
        <button type="button" className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium border-0 cursor-pointer transition-colors hover:bg-white/20">
          Dashboard
        </button>
      ) : (
        <>
          <button type="button" className="bg-transparent border-0 text-gray-400 text-sm font-medium cursor-pointer">Sign in</button>
          <button type="button" className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium border-0 cursor-pointer">Get started</button>
        </>
      )}
    </div>
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

  const headerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    transition: 'all 0.3s',
    backgroundColor: scrolled ? 'rgba(0,0,0,0.8)' : 'transparent',
    backdropFilter: scrolled ? 'blur(8px)' : 'none',
    borderBottom: scrolled ? '1px solid rgba(255,255,255,0.1)' : 'none'
  };

  return (
    <header style={headerStyle}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />
        <div className="hidden md:block">
          <NavLinks links={NAV_LINKS} />
        </div>
        <div className="hidden md:block">
          <UserMenu isLoggedIn={false} />
        </div>
        <button type="button" onClick={toggleMenu} className="block md:hidden bg-transparent border-0 text-gray-400 text-2xl cursor-pointer" aria-label="Toggle menu">☰</button>
      </div>
      {menuOpen && (
        <div className="md:hidden bg-black/95 border-t border-white/10 py-4 px-6">
          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="block py-2 text-gray-400 text-sm no-underline" onClick={() => setMenuOpen(false)}>
              {link.label}
            </a>
          ))}
        </div>
      )}
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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
      <div className={\`relative z-10 text-center px-6 max-w-4xl mx-auto transition-all duration-700 \${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }\`}>
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
          Build something{' '}
          <span className="bg-gradient-to-br from-indigo-300 to-purple-400 bg-clip-text text-transparent">amazing</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          A powerful platform that helps you create, iterate, and ship products faster than ever before.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button type="button" className="px-8 py-3 rounded-xl bg-indigo-500 text-white font-semibold text-lg border-0 cursor-pointer transition hover:bg-indigo-600">
            Get started free
          </button>
          <button type="button" className="px-8 py-3 rounded-xl border border-white/20 bg-transparent text-white font-semibold text-lg cursor-pointer transition hover:border-white/40">
            Watch demo →
          </button>
        </div>
      </div>
    </section>
  );
}

export default Hero;
`,

  scrollRow: `import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

function MovieRow({ title = 'Featured', items = [] }) {
  const rowRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft]   = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const visibleItems = useMemo(() => items.filter((item) => item != null), [items]);

  const updateScrollState = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();
    return () => el.removeEventListener('scroll', updateScrollState);
  }, [updateScrollState]);

  const scroll = useCallback((direction) => {
    const el = rowRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  return (
    <div className="py-8">
      <div className="flex items-center justify-between px-6 mb-4">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={\`p-2 rounded-full bg-white/10 text-white transition-colors disabled:opacity-30 disabled:cursor-default \${
              canScrollLeft ? 'hover:bg-white/20 cursor-pointer' : ''
            }\`}
            aria-label="Scroll left"
          >←</button>
          <button
            type="button"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={\`p-2 rounded-full bg-white/10 text-white transition-colors disabled:opacity-30 disabled:cursor-default \${
              canScrollRight ? 'hover:bg-white/20 cursor-pointer' : ''
            }\`}
            aria-label="Scroll right"
          >→</button>
        </div>
      </div>
      <div
        ref={rowRef}
        className="flex gap-4 overflow-x-auto scrollbar-none px-6 pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {visibleItems.map((item, i) => (
          <div
            key={item.id ?? i}
            className="shrink-0 w-48 rounded-xl overflow-hidden bg-white/5 cursor-pointer transition-colors border border-white/5 hover:bg-white/10"
          >
            <div className="aspect-[2/3] bg-gradient-to-br from-indigo-500/30 to-purple-500/30" />
            <div className="p-3">
              <p className="text-white text-sm font-medium truncate">{item.title ?? item.name}</p>
              <p className="text-gray-400 text-xs mt-0.5">{item.year ?? ''}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MovieRow;
`,

  timer: `import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

function TimerDisplay({ targetDate = null, label = 'Countdown' }) {
  const [now, setNow]     = useState(() => Date.now());
  const intervalRef       = useRef(null);

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
      minutes: Math.floor((diff % 3600000)  / 60000),
      seconds: Math.floor((diff % 60000)    / 1000),
    };
  }, [targetDate, now]);

  const pad = useCallback((n) => String(n).padStart(2, '0'), []);

  if (!timeLeft) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 text-lg">{label}</p>
        <p className="text-white text-2xl font-mono mt-2">No target date set</p>
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
    <div className="text-center py-12 px-6">
      <p className="text-indigo-300 font-medium tracking-wider uppercase text-sm mb-6">{label}</p>
      <div className="flex items-center justify-center gap-4">
        {units.map((unit, i) => (
          <div key={unit.label} className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-5xl font-mono font-bold text-white bg-white/5 rounded-xl py-4 px-6 min-w-[5rem]">
                {pad(unit.value)}
              </div>
              <p className="text-gray-500 text-xs mt-2 uppercase tracking-wider">{unit.label}</p>
            </div>
            {i < units.length - 1 && <span className="text-gray-700 text-4xl font-thin mb-6">:</span>}
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
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!endpoint) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res  = await fetch(endpoint);
        if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
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

  const retry = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border-0 cursor-pointer transition-colors hover:bg-red-500/30"
        >Retry</button>
      </div>
    );
  }

  return (
    <div className="py-8 px-6">
      <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
      <div className="grid gap-4">
        {items.map((item, i) => (
          <div key={item.id ?? i} className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-white font-medium">{item.name ?? item.title ?? String(item)}</p>
          </div>
        ))}
        {items.length === 0 && <p className="text-gray-500 text-center py-8">No items found.</p>}
      </div>
    </div>
  );
}

export default DataList;
`,
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. VALIDATION_PATTERNS
//    Run on every LLM-generated file BEFORE writing to disk.
// ─────────────────────────────────────────────────────────────────────────────

export function validateGeneratedFile(file: FileContent): ValidationResult {
  const errors: string[]   = [];
  const warnings: string[] = [];
  const c = file.content;
  const p = file.path;

  if (!c || c.length < 20) {
    return { valid: false, errors: ['File content is empty or too short'], warnings };
  }

  // REJECT CSS FILES — pipeline does not allow CSS
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
    errors.push(...checkMissingKeyProps(c, p));
    // Tailwind validations removed — now allowed
    errors.push(...checkCssImports(c, p));
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
  const hasImport = c.includes("from 'react'") || c.includes('from "react"');
  return hasImport ? [] : [`[${p}] Missing React import`];
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
    errors.push(
      `[${p}] CRITICAL: useMemo dep array is INSIDE the function argument. ` +
      `Fix: useMemo(() => value, [deps]) — two separate args.`
    );
  }
  if (/useCallback\s*\(\s*\([^)]*,\s*\[/.test(c)) {
    errors.push(
      `[${p}] CRITICAL: useCallback dep array is INSIDE the function argument. ` +
      `Fix: useCallback((x) => fn(x), [deps]) — two separate args.`
    );
  }
  if (/useMemo\s*\(\s*\)/.test(c)) {
    errors.push(`[${p}] useMemo called with no arguments`);
  }
  if (/useCallback\s*\(\s*\)/.test(c)) {
    errors.push(`[${p}] useCallback called with no arguments`);
  }
  return errors;
}

function checkProxyCorruption(c: string, p: string): string[] {
  return /=\s*\/\s*>/.test(c)
    ? [`[${p}] Proxy-corrupted arrow '= />' found — replace with '=>'`]
    : [];
}

function checkRedactedTokens(c: string, p: string): string[] {
  return /<REDACTED_EMAIL>|\[REDACTED(?:_EMAIL)?\]/.test(c)
    ? [`[${p}] Proxy redaction token found — replace with '' or null`]
    : [];
}

function checkNumericIdentifiers(c: string, p: string): string[] {
  const errors: string[] = [];
  if (/import\s+\d\w*\s+from/.test(c)) {
    errors.push(`[${p}] Import identifier starts with a digit (invalid JS)`);
  }
  const base = p.split('/').pop()?.split('.')[0] ?? '';
  if (/^\d/.test(base)) {
    errors.push(`[${p}] Filename starts with a digit (invalid JS identifier)`);
  }
  return errors;
}

function checkBannedPackages(c: string, p: string): string[] {
  const BANNED = [
    'react-router-dom','axios','three','@react-three/fiber','@react-three/drei',
    'gsap','react-intersection-observer','@tanstack/react-query','zustand',
    'recharts','preact','styled-components','@emotion/react','@emotion/styled',
    'classnames','clsx'
  ];
  return BANNED
    .filter((pkg) => c.includes(`'${pkg}'`) || c.includes(`"${pkg}"`))
    .map((pkg) => `[${p}] Banned package '${pkg}' (not installed)`);
}

function checkIfInJSX(c: string, p: string): string[] {
  return /\{[\s\n]*if\s*\(/.test(c)
    ? [`[${p}] if-statement inside JSX {} — use ternary or && operator instead`]
    : [];
}

function checkMissingKeyProps(c: string, p: string): string[] {
  if (/\.map\(\s*(?:\w+|\([^)]*\))\s*=>\s*\(?\s*<[A-Za-z][^>]*(?<!\bkey=\{[^}]*\})[^/]>/.test(c)) {
    return [`[${p}] .map() may render JSX without key prop`];
  }
  return [];
}

function checkCssImports(c: string, p: string): string[] {
  if (/import\s+['"`][^'"`]*\.css['"`]/.test(c)) {
    return [`[${p}] CSS import detected. CSS files are not allowed.`];
  }
  return [];
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
    ? [`[${p}] WARNING: async useEffect — use IIFE: useEffect(() => { (async () => { ... })(); }, [])`]
    : [];
}

function checkMissingDepsArray(c: string, p: string): string[] {
  const warnings: string[] = [];
  if (/useMemo\s*\(/.test(c) && !/useMemo\s*\([^)]+\)\s*,\s*\[/.test(c)) {
    warnings.push(`[${p}] WARNING: useMemo may be missing dep array as second argument`);
  }
  if (/useEffect\s*\(/.test(c) && !/useEffect\s*\([^)]+\)\s*,\s*\[/.test(c)) {
    warnings.push(`[${p}] WARNING: useEffect may be missing dep array as second argument`);
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
    if (lower.includes('landing'))                          return { name: 'ai-landing-app',   pages: ['home', 'pricing', 'contact'] };
    if (lower.includes('dashboard'))                        return { name: 'ai-dashboard-app', pages: ['dashboard', 'analytics', 'settings'] };
    if (lower.includes('blog'))                             return { name: 'ai-blog-app',      pages: ['home', 'post', 'about'] };
    if (lower.includes('portfolio'))                        return { name: 'ai-portfolio-app', pages: ['home', 'projects', 'contact'] };
    if (lower.includes('ecommerce') || lower.includes('shop')) return { name: 'ai-shop-app',  pages: ['home', 'products', 'cart', 'checkout'] };
    if (lower.includes('saas'))                             return { name: 'ai-saas-app',      pages: ['home', 'features', 'pricing', 'contact'] };
    if (lower.includes('social') || lower.includes('community')) return { name: 'ai-social-app', pages: ['feed', 'profile', 'messages', 'explore'] };
    if (lower.includes('admin') || lower.includes('cms'))   return { name: 'ai-admin-app',     pages: ['dashboard', 'users', 'content', 'settings'] };
    if (lower.includes('streaming') || lower.includes('video') || lower.includes('movie')) return { name: 'ai-streaming-app', pages: ['home', 'browse', 'watch', 'profile'] };
    if (lower.includes('music') || lower.includes('audio') || lower.includes('podcast'))   return { name: 'ai-music-app',     pages: ['home', 'library', 'player', 'discover'] };
    return { name: 'ai-generated-app', pages: ['home'] };
  }

  static buildComponentPrompt(
    spec: ComponentSpec,
    alreadyGenerated: string[],
    projectDescription: string
  ): string {
    const category = ProjectPlanner.detectCategory(spec.name, spec.description);
    const template = COMPONENT_TEMPLATES[category] ?? COMPONENT_TEMPLATES.base;

    return `You are an elite React engineer. Output ONLY raw file content.
No markdown. No backticks. No explanations. No "use client". No TypeScript.
The VERY FIRST character must be the first character of the file.

${CODEGEN_RULES}

━━━ PROJECT CONTEXT ━━━
${projectDescription}

━━━ FILE TO GENERATE ━━━
Path:       ${spec.path}
Component:  ${spec.name}
Purpose:    ${spec.description}
Animations: ${spec.hasAnimation ? 'YES — use framer-motion for animations' : 'NO'}
Has data:   ${spec.hasData ? 'YES — use realistic placeholder data arrays (at least 4 items)' : 'NO'}

━━━ ALREADY GENERATED (safe to import — use exact paths below) ━━━
${alreadyGenerated.length > 0 ? alreadyGenerated.join('\n') : '(none — do not import from other components)'}

━━━ REFERENCE SKELETON (follow this structure exactly) ━━━
${template}

━━━ CRITICAL REMINDERS ━━━
useMemo(() => value, [deps])          ← dep array is SECOND arg to useMemo
useCallback((x) => fn(x), [deps])     ← dep array is SECOND arg to useCallback
useEffect(() => { ... }, [])          ← dep array ALWAYS REQUIRED
Sub-components (Logo, NavLinks, UserMenu) → define them IN THIS FILE if not imported above
NEVER write explanation text after export default
Start writing the file now:`;
  }

  static detectCategory(name: string, description: string): string {
    const s = (name + ' ' + description).toLowerCase();
    if (/header|navbar|nav\b/.test(s))          return 'header';
    if (/hero|landing|banner|splash/.test(s))   return 'hero';
    if (/timer|countdown|clock/.test(s))        return 'timer';
    if (/row|carousel|slider|scroll/.test(s))   return 'scrollRow';
    if (/fetch|api|data.*list/.test(s))         return 'dataFetch';
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
  const unused: string[]  = [];
  const importLines       = content.split('\n').filter((l) => l.trim().startsWith('import '));
  const body              = content.replace(/^import[^\n]+$/gm, '');

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
    errors.push(
      `[${filePath}] useMemo: dep array is inside the first arg. ` +
      `Correct: useMemo(() => value, [deps])`
    );
  }
  if (/useCallback\s*\(\s*\([^)]*,\s*\[/.test(content)) {
    errors.push(
      `[${filePath}] useCallback: dep array is inside the first arg. ` +
      `Correct: useCallback((x) => fn(x), [deps])`
    );
  }
  if (/useMemo\s*\(\s*\(\s*\)\s*=>\s*[^,)]+\s*\)(?!\s*,)/.test(content)) {
    errors.push(`[${filePath}] useMemo missing dep array as second argument`);
  }
  if (/useEffect\s*\(\s*async\s/.test(content)) {
    errors.push(`[${filePath}] async useEffect — use IIFE pattern instead`);
  }
  return errors;
}

export function detectIdentifierTypos(content: string): { hasTypos: boolean; found: Array<[string, string]> } {
  const TYPO_MAP: Array<[RegExp, string]> = [
    [/\bhandlleScroll\b/g, 'handleScroll'],
    [/\bscrolllTo\b/g,     'scrollTo'],
    [/\buserState\b/g,     'useState'],
    [/\busestate\b/g,      'useState'],
    [/\buseEffekt\b/g,     'useEffect'],
    [/\buseCallbakc\b/g,   'useCallback'],
    [/\buseContxt\b/g,     'useContext'],
    [/\bclassname\b/g,     'className'],
    [/\bClassname\b/g,     'className'],
    [/\bonclick\b/g,       'onClick'],
    [/\bconsoloe\b/g,      'console'],
    [/\bfucntion\b/g,      'function'],
    [/\bretrun\b/g,        'return'],
    [/\bimprot\b/g,        'import'],
    [/\bdefualt\b/g,       'default'],
  ];
  const found: Array<[string, string]> = [];
  for (const [re, correct] of TYPO_MAP) {
    if (re.test(content)) found.push([re.source.replace(/\\b/g, ''), correct]);
  }
  return { hasTypos: found.length > 0, found };
}

export function findMissingComponentFiles(
  usedComponents: string[],
  definedOrImported: string[]
): string[] {
  const defined  = new Set(definedOrImported);
  const BUILTINS = new Set([
    'React','Fragment','Suspense','StrictMode','ErrorBoundary',
    'Router','Route','Routes','Navigate','Link','Switch','Provider','Consumer','Canvas',
  ]);
  return usedComponents.filter((name) => !defined.has(name) && !BUILTINS.has(name));
}

export function sanitiseComponentFilename(filename: string): string {
  const ext  = filename.includes('.') ? '.' + filename.split('.').pop() : '';
  const base = filename.slice(0, filename.length - ext.length);
  if (!/^\d/.test(base)) return filename;
  const m = base.match(/^(\d+)(.*)/);
  if (!m) return filename;
  const digits   = m[1];
  const rest     = m[2];
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