# Component Pool v2.0 — AI Website Builder

Production-grade React component library powering the AI website builder.
Every section, block, primitive, animation, hook and util is pre-built and ready for the AI to compose into any website type.

## Structure

```
src/lib/component-pool/
├── primitives/     60+ atoms (Button, Input, Modal, Toast, Avatar…)
├── blocks/        100+ sections (Navbar, Hero, Pricing, Dashboard, Auth…)
├── animations/     35+ effects (FadeIn, CountUp, Typewriter, Marquee…)
├── layouts/        25+ page shells (LandingPage, DashboardLayout, AuthLayout…)
├── hooks/          16 React hooks (useFetch, useForm, useDarkMode…)
├── utils/          formatting, validators, DOM, storage, API helpers
├── themes/         design tokens (colors, typography, spacing, shadows)
├── registry/       machine-readable manifest + aliases
└── snippets/       auto-generated LLM context snippets
```

## Quick usage

```jsx
import { LandingPage, Navbar, Hero, Features, Pricing, CTA, Footer } from "@/lib/component-pool";

export default function MySaaSLanding() {
  return (
    <LandingPage>
      <Navbar links={[{ label:"Features", href:"#features" }]} actions={[{ label:"Get started", href:"/sign-up" }]} />
      <Hero
        eyebrow="Launching now"
        title="The platform that builds itself"
        subtitle="AI-generated websites in seconds."
        actions={[{ label:"Start free", href:"/sign-up" }, { label:"See demo", href:"#demo", variant:"secondary" }]}
      />
      <Features title="Everything you need" features={[...]} />
      <Pricing plans={[...]} />
      <CTA title="Ready to ship?" primaryCTA={{ label:"Get started", onClick:() => {} }} />
      <Footer columns={[...]} />
    </LandingPage>
  );
}
```

## Scripts

```bash
node scripts/build-registry.js       # Rebuild components.json
node scripts/generate-snippets.js    # Rebuild LLM snippets
node scripts/validate-components.js  # Check all files exist
node scripts/sync-to-sandbox.js      # Sync to visual testing env
```

## Adding a new component

1. Create `src/lib/component-pool/blocks/MySection/MySection.jsx`
2. Create `src/lib/component-pool/blocks/MySection/index.js`
3. Add export to `src/lib/component-pool/blocks/index.js`
4. Run `build-registry` and `generate-snippets`
5. The AI can now use it automatically.

## Design principles

- **No TypeScript in .jsx** — pure JS for maximum AI compatibility
- **Tailwind CSS only** — no inline styles except dynamic values
- **Composition-first** — components accept children and render-props, not giant config objects
- **Dark mode built-in** — every component works with Tailwind `dark:` variants
- **Accessible** — ARIA roles, keyboard navigation, focus management included
- **Tree-shakeable** — named exports, no default barrel that imports everything
