# OPUS Plan Analysis vs Current Codebase

**Date:** April 19, 2026  
**Status:** Plan is SOLID but requires Prisma schema enhancements + realistic phasing

---

## SECTION 1: PLAN VALIDATION AGAINST CURRENT STRUCTURE

### ✅ WHAT THE OPUS PLAN GETS RIGHT

#### 1. **Data Model Exists**
Your Prisma schema already has the core models:
- `AIProject` — good foundation
- `AIProjectFile` — stores path + content ✓
- `AIMessage` — tracks role (USER/ASSISTANT) and status (PENDING/DONE/ERROR) ✓

The models are minimal but sufficient for Phase 1.

#### 2. **Component Pool Structure Exists**
Your actual structure matches the plan:
```
src/lib/component-pool/
├── primitives/      ✓ (exists)
├── blocks/          ✓ (exists)
├── animations/      ✓ (exists)
├── hooks/           ✓ (exists)
├── layouts/         ✓ (exists)
├── utils/           ✓ (exists)
├── themes/          ✓ (exists)
├── registry/        ✓ (exists, but bare-bones)
├── constants.js     ✓ (exists)
├── index.js         ✓ (exists)
└── README.md        ✓ (exists)
```

#### 3. **AI Engine Structure Is Already Roughly Right**
Your `src/lib/ai/` has:
- `llm/` folder ✓ — engine entry points live here
- `engine/` folder ✓ — batch-generator, design-system, etc. exist
- `types/` folder ✓ — type definitions live here
- `validation/` folder ✓ — quality checks belong here
- `context/` folder — for prompt assembly
- `exporters/`, `router/`, `stream/` — supporting concerns

#### 4. **Inngest Pipeline Exists**
You have:
- `src/inngest/client.ts` ✓
- `src/inngest/functions.ts` ✓ — currently 6 steps
- `src/inngest/ai-builder.ts` ✓ — trigger function
- `src/inngest/types.ts` ✓
- `src/inngest/utils.ts` ✓

**The skeleton is there.** Only needs expansion from 6 → 10 steps.

---

## SECTION 2: WHAT NEEDS TO CHANGE

### ⚠️ PRISMA SCHEMA CHANGES (REQUIRED)

The OPUS plan mentions `AIProject.registryVersion` for reproducibility. **This should be added:**

```prisma
model AIProject {
  id              String   @id @default(uuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  name            String
  description     String?  @db.Text
  subAccountId    String

  // NEW: Track which registry was used for reproducibility
  registryVersion String?  // SHA-256 hash of components.metadata.json at generation time
  
  // NEW: Track intent parsing output for debugging/replay
  sitePlan        String?  @db.LongText // JSON of SitePlan

  files           AIProjectFile[]
  messages        AIMessage[]

  @@map("AIProject")
  @@index([subAccountId])
}

model AIProjectFile {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  path      String   @db.VarChar(500)
  content   String   @db.LongText
  projectId String
  
  // NEW: Track provenance for debugging
  provenance String  @default("custom") // "pool" | "custom" | "assembly"
  
  // NEW: Track validation status per file
  validationStatus String @default("PENDING") // "PENDING" | "PASSED" | "FAILED"

  project AIProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("AIProjectFile")
  @@unique([projectId, path])
  @@index([projectId])
}

model AIMessage {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  projectId      String
  role           String  // "USER" | "ASSISTANT"
  content        String  @db.LongText
  status         String  @default("PENDING") // "PENDING" | "DONE" | "ERROR"
  filesGenerated Int?
  
  // NEW: Track which pipeline step failed (if error)
  failedAtStep   String? // "parse-intent" | "resolve-components" | "validate-quality" | etc.
  
  // NEW: Track errors from validation for display
  validationErrors String? @db.LongText // JSON array of {file, message, line}

  project AIProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("AIMessage")
  @@index([projectId])
}
```

**Why these changes:**
- `registryVersion`: Allows you to replay a generation against the same registry snapshot
- `sitePlan`: Debugging aid; lets you inspect what the intent parser produced
- `provenance`: Understand which files came from pool vs custom generation
- `validationStatus`: Track quality gate status per file
- `failedAtStep` + `validationErrors`: Better error reporting to users

**Migration cost:** Low. These are additive fields with sensible defaults. Existing records won't break.

---

### 🔴 FILES THAT MUST BE CREATED (NO SHORTCUTS)

These are **hard requirements** for the plan to work:

#### Registry Metadata System
1. **src/lib/component-pool/registry/components.metadata.json** — NEW
   - Currently: doesn't exist
   - Needed by: resolver, LLM context builders
   - Generation: `scripts/build-registry.js` (modified) will create it
   - Start with: 10 hand-authored components for Phase 1

2. **src/lib/component-pool/{primitives,blocks,...}/<comp>/meta.ts** — NEW (per component)
   - Currently: doesn't exist
   - Pattern: Every component needs one
   - Start with: Button, Input, Modal, Hero, Features, Pricing, CTA, Footer, Navbar, Card
   - These 10 will feed into components.metadata.json

3. **src/lib/component-pool/registry/types.ts** — NEW
   - Defines: ComponentMeta, PropDef, SlotDef, Variant, SemanticIntent
   - Shared by: build-registry.js and runtime resolver
   - Size: ~150 lines

4. **src/lib/component-pool/registry/index.ts** — NEW (typed loader)
   - Currently: registry/index.js exists but is bare (3 functions)
   - Needed: Rich query API with search/scoring
   - Size: ~200 lines

#### AI Builder Redesign
5. **src/lib/types/site-plan.ts** — NEW
   - Output type of intent parser
   - Input to all downstream resolvers
   - Size: ~80 lines

6. **src/lib/design-system/tokens/base.ts** — NEW
   - Defines the token taxonomy (closed set of CSS variable names)
   - Size: ~100 lines

7. **src/lib/design-system/resolve-tokens.ts** — NEW
   - Converts theme name → CSSVariableManifest
   - Size: ~80 lines

8. **src/lib/resolver/score-section.ts** — NEW
   - Pure scoring function (component matching)
   - Size: ~120 lines

9. **src/lib/resolver/decide-tier.ts** — NEW
   - Maps score → POOL_MATCH | POOL_ADAPT | CUSTOM_GENERATE
   - Size: ~40 lines

10. **src/lib/validation/check-tokens.ts** — NEW
    - Regex scan for hardcoded values
    - Size: ~80 lines

11. **src/lib/validation/check-content.ts** — NEW
    - Placeholder text detection
    - Size: ~60 lines

12. **src/lib/validation/check-a11y.ts** — NEW
    - AST-based a11y checks
    - Size: ~100 lines

13. **src/inngest/steps/parse-intent.ts** — NEW
    - LLM → SitePlan (structured)
    - Size: ~60 lines

14. **src/inngest/steps/resolve-design-tokens.ts** — NEW
    - Reads theme config, returns CSSVariableManifest
    - Size: ~40 lines

15. **src/inngest/steps/build-registry-context.ts** — NEW
    - Per-section registry slice assembly
    - Size: ~80 lines

16. **src/inngest/steps/resolve-components.ts** — NEW (the heart)
    - Tier decision + LLM routing
    - Size: ~150 lines

**Total new lines:** ~1,500 lines of code

---

### 🟡 FILES THAT MUST BE MODIFIED (SUBSTANTIAL CHANGES)

1. **src/inngest/functions.ts**
   - Current: 6-step linear pipeline
   - Change: Expand to 10 steps, reorganize into separate files
   - Effort: Medium (restructuring, not new logic)

2. **src/lib/ai/llm/plan-project.ts**
   - Current: Unknown (not provided)
   - Change: Return SitePlan (structured) not freeform text
   - Effort: Low-medium (depends on current implementation)

3. **src/lib/ai/llm/generate-code.ts**
   - Current: Monolithic generation (presumably)
   - Change: Becomes dispatcher; actual logic moves to generate-props.ts, generate-custom.ts
   - Effort: Medium

4. **scripts/build-registry.js**
   - Current: Walks folders, outputs component names
   - Change: Walks folders, reads meta.ts files, outputs rich metadata
   - Effort: Low-medium

5. **scripts/validate-components.js**
   - Current: Checks .jsx + index.js exist
   - Change: Also check meta.ts exists and is valid
   - Effort: Low

---

### 🟢 FILES THAT ARE GOOD AS-IS

- `src/inngest/client.ts` — keep unchanged
- `src/inngest/ai-builder.ts` — keep unchanged (trigger function)
- `src/lib/component-pool/constants.js` — keep as-is
- `src/lib/component-pool/utils/cn.js` — keep as-is
- `src/lib/component-pool/themes/base.js` — existing token system, refactor into tokens/base.ts but logic stays same
- Most utility functions in `src/lib/ai/utils/`

---

## SECTION 3: REALISTIC PHASING

### Phase 1 Timeline: **2-3 weeks** (not 1 week as OPUS optimistically suggested)

**Week 1:**
- Add 4 fields to Prisma schema (1 day)
- Create types: site-plan.ts, registry/types.ts, resolver types (2 days)
- Create design-system/tokens and resolution logic (2 days)
- Hand-author meta.ts for 10 key components (2-3 days) ← **Most time-consuming**

**Week 2:**
- Modify build-registry.js to read meta.ts and generate components.metadata.json (1 day)
- Create registry/index.ts typed loader (1.5 days)
- Create scorer (score-section.ts, decide-tier.ts) (1.5 days)
- Create Inngest steps/parse-intent.ts through resolve-components.ts (2 days)
- Modify src/inngest/functions.ts to wire 10-step pipeline (1.5 days)

**Week 3:**
- Create validation layer (check-tokens, check-content, check-a11y) (2 days)
- Wire validation into Inngest pipeline (1 day)
- E2E testing: full generation for 1-2 site types (2 days)
- Bug fixes and tuning (1-2 days)

**Acceptance criteria:**
- Generate a landing page using ≥3 pool components
- Zero hardcoded colors (all var(--*))
- WebContainer boots without import errors
- End-to-end runtime < 60s

---

## SECTION 4: CRITICAL SUCCESS FACTORS

### 🎯 Do This First (Foundation)

1. **Hand-author meta.ts for 10 components**
   - This is NOT optional. Without metadata, the resolver has nothing to work with.
   - Pick: Button, Input, Card, Modal, Hero, Features, Pricing, CTA, Footer, Navbar
   - Effort: 3-4 days but absolutely worth it
   - Each meta.ts is ~40-80 lines

2. **Get planProject() returning SitePlan**
   - If this breaks or returns freeform text, everything downstream fails.
   - Test with a fixture: prompt → SitePlan schema validation MUST pass.
   - This is the gate for Step 3.

3. **Get design tokens working**
   - Create the closed-set token taxonomy
   - Verify the manifest can be generated from a theme
   - Test that a component can be generated using only var(--*) tokens
   - This gate-keeps Steps 4–6.

### 🚫 Don't Do This (Scope Creep in Phase 1)

- Session cache (Phase 3) — add after Phase 1 proves the core works
- POOL_ADAPT path (Phase 3) — just do POOL_MATCH and CUSTOM_GENERATE first
- Performance optimization (Phase 4) — use tokens; other concerns later
- SEO/meta generation (Phase 4) — not in MVP
- Snapshot/WebContainer changes (Phase 4) — current snapshot is fine for now

---

## SECTION 5: HONEST RISK ASSESSMENT

### 🔴 High Risk

**LLM structured output reliability**
- The plan relies on planProject() returning valid SitePlan JSON
- If your LLM provider's JSON mode is flaky, this breaks everything
- Mitigation: Add retry + fallback to defaults; do NOT punt to user

**Hand-authoring 10 meta.ts files**
- Not a technical risk, but a **time risk**
- One typo in a PropDef → resolver scores poorly
- Mitigation: Create a meta.ts template; code-review carefully

**Validation loop regression**
- If the validator is too strict, everything fails on regen; if too loose, quality drifts
- Thresholds not tuned to your LLM
- Mitigation: Start permissive; tighten based on real generations

### 🟡 Medium Risk

**Prisma migration**
- Adding fields is safe, but ensure deploy process handles schema changes
- No data loss, but downtime if you use Azure SQL or similar

**Registry rebuild script (build-registry.js)**
- If it breaks, components.metadata.json won't regenerate
- Mitigation: Make the script idempotent and add a --dry-run flag

**Inngest step retry semantics**
- Cache state across retries — must serialize/deserialize carefully
- If session cache isn't passed through steps properly, duplicates appear
- Mitigation: Test retries with actual Inngest backoff

### 🟢 Low Risk

- Type definitions — just TypeScript, can't break at runtime
- Utility functions — pure functions, easy to test
- Design system refactor — isolated concern, no other code depends on internals

---

## SECTION 6: MISSING PIECES IN OPUS PLAN

These are things OPUS didn't mention but you'll need:

### 1. **LLM Model Selection & Rate Limiting**
- OPUS assumes one LLM call per generation.
- You have multiple models available (moonshotai/kimi-k2, mistralai/mistral-large, meta/llama).
- Inngest doesn't enforce rate limits by default.
- **Action:** Add explicit model routing in plan-project.ts; implement concurrency limits in resolve-components.ts (max 4 parallel sections).

### 2. **Error Context Propagation**
- OPUS says "regenerate section with error context" but doesn't specify the format.
- If generateProps() fails validation, what context goes back to the LLM?
- **Action:** Create a wrapper function that formats validation errors into a "correction prompt" and passes it to retry generation.

### 3. **Token Budget Tracking**
- OPUS doesn't mention token cost — you'll rack up huge bills if you're not careful.
- With 10 steps × multiple retry paths, cost can balloon.
- **Action:** Add token tracking to every LLM call; log total cost per generation; add a hard ceiling (e.g., abort if > $0.50 per project).

### 4. **Fallback When Pool Is Empty**
- What if searchComponents() returns 0 candidates?
- OPUS defaults to CUSTOM_GENERATE, but that's expensive.
- **Action:** Define a "last-resort" generic component (e.g., a bare white box) that every section can map to, so you never generate from scratch for something basic.

### 5. **User Feedback Loop**
- OPUS doesn't mention how users see validation failures.
- If Step 8 (validate-quality) finds 5 errors, how does the user know?
- **Action:** Add a field to AIMessage for partial results + inline error markers in the code viewer.

---

## SECTION 7: RECOMMENDATION

### ✅ **VERDICT: Execute the OPUS plan, with modifications**

**Why:**
1. Your data model is already there — no rework needed.
2. Component pool structure matches — just needs metadata layer.
3. Inngest infra is there — just needs expansion.
4. The 3-tier decision model is sound and maps to code cleanly.
5. Validation layer is low-risk and high-value.

**How:**
1. **Apply Prisma schema changes immediately** (Section 2).
2. **Start Phase 1 with the hand-authored metadata** (10 components in 3-4 days).
3. **Build the resolver + Inngest pipeline in parallel** (2 people, 2 weeks).
4. **Validate on real prompts before shipping** (1 week of integration testing).
5. **Go live with strict thresholds, then tune** (after real usage data).

**Don't:**
- Try to auto-generate meta.ts from existing components — manual authoring forces you to understand each component's semantics.
- Skip validation layer in Phase 1 — it's the guardrail that prevents garbage output.
- Optimize performance until Phase 1 ships — prove the core works first.
- Over-tune LLM scoring thresholds without data — start conservative (match: 0.85, adapt: 0.65).

---

## SECTION 8: NEXT IMMEDIATE ACTIONS

### This Week:

1. **Update prisma/schema.prisma** with the 5 new fields
   ```bash
   npx prisma migrate dev --name "add_ai_tracking_fields"
   ```

2. **Create src/lib/types/site-plan.ts** — Start here, it's foundational
   - Define SitePlan, Page, Section, SemanticIntent types
   - This unblocks: planProject.ts refactoring, resolver testing

3. **Create src/lib/component-pool/registry/types.ts**
   - Define ComponentMeta, PropDef, Variant, etc.
   - This unblocks: build-registry.js refactoring, meta.ts authoring

4. **Start meta.ts for first 3 components** (Button, Hero, Card)
   - These are your "test fixtures" for the registry system
   - Get build-registry.js generating metadata from these
   - Verify components.metadata.json is valid JSON

### Next 2 Weeks:

5. Finish 7 more meta.ts files
6. Modify planProject.ts to return SitePlan
7. Create resolver (scorer + tier decider)
8. Create Inngest steps/parse-intent.ts through resolve-components.ts
9. Modify src/inngest/functions.ts to wire 10-step pipeline

---

## APPENDIX: File Creation Checklist

**Print this and track:**

- [ ] Prisma schema migrated
- [ ] src/lib/types/site-plan.ts
- [ ] src/lib/component-pool/registry/types.ts
- [ ] src/lib/component-pool/registry/index.ts
- [ ] meta.ts for Button
- [ ] meta.ts for Input
- [ ] meta.ts for Card
- [ ] meta.ts for Modal
- [ ] meta.ts for Hero
- [ ] meta.ts for Features
- [ ] meta.ts for Pricing
- [ ] meta.ts for CTA
- [ ] meta.ts for Footer
- [ ] meta.ts for Navbar
- [ ] scripts/build-registry.js (modified)
- [ ] scripts/validate-components.js (modified)
- [ ] src/lib/design-system/tokens/base.ts
- [ ] src/lib/design-system/resolve-tokens.ts
- [ ] src/lib/resolver/score-section.ts
- [ ] src/lib/resolver/decide-tier.ts
- [ ] src/lib/validation/check-tokens.ts
- [ ] src/lib/validation/check-content.ts
- [ ] src/lib/validation/check-a11y.ts
- [ ] src/inngest/steps/parse-intent.ts
- [ ] src/inngest/steps/resolve-design-tokens.ts
- [ ] src/inngest/steps/build-registry-context.ts
- [ ] src/inngest/steps/resolve-components.ts
- [ ] src/lib/ai/llm/generate-props.ts
- [ ] src/lib/ai/llm/generate-custom.ts
- [ ] src/inngest/functions.ts (modified for 10-step pipeline)

---

**Confidence Level:** 85% — Plan is solid; execution risk is moderate (mainly hand-authoring metadata, not architecture).
