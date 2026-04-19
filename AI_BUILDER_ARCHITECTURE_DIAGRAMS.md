# AI Builder System - Architecture Diagrams

## 1. Generation Pipeline Flow (High-Level)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INPUT PROMPT                             │
│                  (1-5000 chars, natural language)                    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ COMPLEXITY DETECTION    │
                    │ - Regex keywords        │
                    │ - Simple/Complex mode   │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┴─────────────────────┐
         │                                             │
    ┌────▼─────┐                              ┌──────▼──────┐
    │  SIMPLE   │                              │  COMPLEX    │
    │ 2-4 files │                              │  5-12 files │
    └────┬─────┘                              └──────┬──────┘
         │                                             │
         │         ┌───────────────────────────┐      │
         └─────────▶│   PLANNER LLM STAGE      │◀─────┘
                    │ - File list generation   │
                    │ - Dependencies mapping   │
                    │ - Budget: 4096 tokens    │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  BATCH GENERATOR STAGE  │
                    │ - Parallel: 3 files/req │
                    │ - Retries: up to 3x     │
                    │ - Budget: 6000 tokens   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   STREAMING MONITOR     │
                    │ - Real-time file events │
                    │ - Health pings (7s)     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ POST-PROCESSING STAGE   │
                    │ - JSX validation        │
                    │ - Import reconciliation │
                    │ - File tree assembly    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ PERSISTENCE STAGE       │
                    │ - WebContainer write    │
                    │ - Snapshot generation   │
                    │ - Build execution       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   COMPLETE PROJECT      │
                    │  Ready for preview/use  │
                    └─────────────────────────┘
```

---

## 2. Design Token System Flow

```
USER PROMPT
     │
     ▼
┌─────────────────────────────────────────┐
│ KEYWORD MATCHING (Regex)                │
├─────────────────────────────────────────┤
│ • /saas|dashboard|admin|.../ → SaaS     │
│ • /finance|bank|crypto|.../ → Finance  │
│ • /shop|store|ecommerce|.../ → Ecom    │
│ • /creative|art|design|.../ → Creative │
│ • /stream|video|media|.../ → Streaming │
│ • /health|medical|clinic|.../ → Health │
│ • /learn|education|school|.../ → Edu   │
│ • DEFAULT → Modern                      │
└────────────────────┬────────────────────┘
                     │
         ┌───────────▼────────────┐
         │ PROJECT TYPE DETECTED  │
         └───────────┬────────────┘
                     │
         ┌───────────▼─────────────────────────┐
         │ DESIGN TOKENS APPLIED               │
         ├─────────────────────────────────────┤
         │ primary:        [HEX code]          │
         │ primaryLight:   [HEX code]          │
         │ accent:         [HEX code]          │
         │ gradient:       [Linear/Radial]     │
         │ background:     [HEX code]          │
         │ textMuted:      [HEX code]          │
         └───────────┬─────────────────────────┘
                     │
         ┌───────────▼────────────┐
         │ TEMPLATE INJECTION     │
         ├────────────────────────┤
         │ Hero   → gradient hero │
         │ Nav    → primary nav   │
         │ Card   → accent cards  │
         │ CTA    → primary btn   │
         │ Footer → bg color      │
         └────────────────────────┘
                     │
         ┌───────────▼────────────┐
         │ CONSISTENT BRANDING    │
         │ Applied across all     │
         │ generated components   │
         └────────────────────────┘
```

---

## 3. Rate Limiting Architecture

```
REQUEST ARRIVES
      │
      ▼
┌──────────────────────────────────┐
│ CHECK RATE LIMIT                 │
│ Rolling Window: 62 seconds       │
│ Max Requests: 5 per minute       │
└──────────────────┬───────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────▼────┐         ┌────▼────┐
    │ ALLOW   │         │  BLOCK  │
    │ Process │         │ Queue   │
    └────┬────┘         │ & Wait  │
         │              └────┬────┘
         │                   │
         │         ┌─────────▼──────────┐
         │         │ CALCULATE WAIT TIME│
         │         │ (62s - elapsed)    │
         │         └─────────┬──────────┘
         │                   │
         │         ┌─────────▼──────────┐
         │         │ LOG WAIT MESSAGE   │
         │         │ "[RL] Waiting X.Xs"│
         │         └─────────┬──────────┘
         │                   │
         │         ┌─────────▼──────────┐
         │         │ RETRY AFTER DELAY  │
         │         └────────────┬───────┘
         │                      │
         └──────────────────────┘
                   │
         ┌─────────▼──────────┐
         │ PROCESS REQUEST    │
         │ Add timestamp to   │
         │ request history    │
         └────────────────────┘
```

---

## 4. File Generation Batch Process

```
FILE LIST [5 files total]
         │
    ┌────┴────────────────────────────┐
    │                                  │
┌───▼──┐    ┌───────┐    ┌───────┐   │
│File1 │    │File2  │    │File3  │   │ ← BATCH 1 (3 files)
│Hero  │    │Nav    │    │Footer │   │
└───┬──┘    └───┬───┘    └───┬───┘   │
    │           │            │        │
    └───────────┴────────────┘        │
              │                        │
    ┌─────────▼─────────┐            │
    │ LLM CALL          │            │
    │ Batch CODEGEN     │            │
    │ 6000 token budget │            │
    └─────────┬─────────┘            │
              │                      │
    ┌─────────▼─────────────┐        │
    │ STREAM RESULTS        │        │
    │ FILE_START            │        │
    │ FILE_CHUNK (...)      │        │
    │ FILE_CHUNK (...)      │        │
    │ FILE_END              │        │
    └─────────┬─────────────┘        │
              │                      │
    ┌─────────▼─────────────┐        │
    │ VALIDATION            │        │
    │ ✓ JSX syntax OK       │        │
    │ ✓ Imports valid       │        │
    │ ✓ Min chars met       │        │
    └──────────┬────────────┘        │
              │                      │
              │                      │
    ┌─────────┴────────┐            │
    │                  │            │
┌───▼──┐    ┌───────┐ │    ┌───────▼┐
│File4 │    │File5  │ │    │Success?│
│About │    │Contact│ │    └────────┘
└───┬──┘    └───┬───┘ │         │
    │           │     │         │
    └───────────┴─────┘         │
              │                 │
    ┌─────────▼─────────┐       │
    │ BATCH 2 (2 files) │       │
    │ LLM CALL          │       │
    │ Same process...   │       │
    └─────────┬─────────┘       │
              │                 │
              │         ┌───────▼────────┐
              │         │ FAILURE?       │
              │         │ Retry (x3)     │
              │         │ with lower temp│
              │         └───────┬────────┘
              │                 │
              └─────────────────┘
                        │
              ┌─────────▼─────────┐
              │ ALL FILES READY   │
              │ Proceed to post-  │
              │ processing stage  │
              └───────────────────┘
```

---

## 5. File Tree & Import Reconciliation

```
GENERATED FILES (from LLM)
         │
┌────────┴─────────────────┐
│                          │
▼                          ▼
Hero.tsx                  Nav.tsx
─────────────             ─────────────
import Card from          import { Card }
  './components/Card'     from '@/components'
                          import Hero
import Btn                from './Hero'
  from '@/ui/Btn'

│                          │
└────────────┬─────────────┘
             │
    ┌────────▼────────────┐
    │ EXTRACT IMPORTS     │
    │ - Named imports     │
    │ - Default imports   │
    │ - Namespace imports │
    └────────┬────────────┘
             │
    ┌────────▼────────────────┐
    │ MAP TO PROJECT          │
    │ Sources:                │
    │ • @/components → found  │
    │ • @/ui → found          │
    │ • ./components → search │
    └────────┬────────────────┘
             │
    ┌────────▼─────────────────┐
    │ MISSING DEPENDENCIES?    │
    │ Card → NOT FOUND         │
    │ Btn → NOT FOUND          │
    └────────┬─────────────────┘
             │
    ┌────────▼──────────────────┐
    │ CREATE STUBS             │
    │                          │
    │ export default function  │
    │ Card() {                 │
    │   return <div>Card</div> │
    │ }                        │
    │                          │
    │ export default function  │
    │ Btn() {                  │
    │   return <button>Btn</button>│
    │ }                        │
    └────────┬──────────────────┘
             │
    ┌────────▼──────────────┐
    │ SORT IMPORTS (stable) │
    │ ✓ Alphabetical        │
    │ ✓ Consistent ordering │
    └────────┬──────────────┘
             │
    ┌────────▼──────────────┐
    │ COMPLETE FILE TREE    │
    │ Ready for WebContainer│
    └───────────────────────┘
```

---

## 6. Streaming Event Flow

```
CLIENT CONNECTS
      │
      ▼
┌──────────────────────┐
│ STREAM ESTABLISHED   │
│ SSE/WebSocket        │
└──────────┬───────────┘
           │
EVERY 7 SECONDS (PING)
           │
┌──────────▼───────────┐         ┌─────────────────┐
│ GENERATION_START     │         │ Health Check    │
│ • totalFiles: 5      │         │ Client responds │
│ • targetChars: 2000  │         └─────────────────┘
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│ FILE_START           │
│ • fileName: Hero.tsx │
│ • index: 0           │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│ FILE_CHUNK           │
│ • content: "export..." (partial)
└──────────┬───────────┘
           │
           (more chunks...)
           │
┌──────────▼───────────┐
│ FILE_END             │
│ • chars: 450         │
│ • lines: 25          │
└──────────┬───────────┘
           │
           (repeat for File 2, 3, ...)
           │
           ...
           │
┌──────────▼───────────────────────┐
│ GENERATION_COMPLETE              │
│ • totalFiles: 5                  │
│ • totalChars: 2150               │
│ • elapsedMs: 45000               │
└──────────────────────────────────┘
           │
┌──────────▼───────────┐
│ STREAM CLOSES        │
│ Client disconnects   │
└──────────────────────┘
```

---

## 7. Error Recovery Flow

```
LLM REQUEST FAILS
      │
      ▼
┌──────────────────────────────┐
│ ANALYZE ERROR TYPE           │
└──────┬───────────┬───────────┘
       │           │           
    ┌──▼──┐   ┌────▼────┐   ┌─────────────┐
    │Parse│   │ Rate    │   │   Token     │
    │Error│   │ Limited │   │ Overflow    │
    └──┬──┘   └────┬────┘   └─────┬───────┘
       │           │              │
       ▼           ▼              ▼
    ┌──────┐  ┌────────┐    ┌──────────┐
    │Auto- │  │ Wait & │    │Reduce    │
    │Fix   │  │ Retry  │    │File List │
    │Token │  │with    │    │ Replan   │
    │      │  │Backoff │    │          │
    └──┬───┘  └────┬───┘    └──┬───────┘
       │           │           │
       ▼           ▼           ▼
    ┌────────────────────────────────┐
    │ RETRY WITH LOWER TEMPERATURE   │
    │ Attempt 1: T=0.7 (balanced)    │
    │ Attempt 2: T=0.5 (safer)       │
    │ Attempt 3: T=0.3 (conservative)│
    └────────┬─────────────────────┘
             │
       ┌─────┴─────┐
       │           │
    ┌──▼──┐    ┌───▼───┐
    │Success│   │Failed │
    │Continue│   │3x     │
    └─────┘    │       │
               └───┬───┘
                   │
            ┌──────▼──────┐
            │ Mark File   │
            │ as Failed   │
            │ Move to     │
            │ next batch  │
            └─────────────┘
```

---

## 8. Component Template Selection

```
FILE TO GENERATE
      │
┌─────▼──────────────────────┐
│ PATTERN MATCHING (Regex)    │
└──┬───┬───┬───┬───┬────┬────┘
   │   │   │   │   │    │
   │   │   │   │   │    └─────────────┐
   │   │   │   │   │                  │
   │   │   │   │   └──────────────┐   │
   │   │   │   │                  │   │
   │   │   │   └──────────────┐   │   │
   │   │   │                  │   │   │
   │   │   └──────────────┐   │   │   │
   │   │                  │   │   │   │
   │   └──────────────┐   │   │   │   │
   │                  │   │   │   │   │
   └──────────────┐   │   │   │   │   │
                  │   │   │   │   │   │
        ┌─────────▼─┐ │   │   │   │   │
        │/nav/      │ │   │   │   │   │
        │nav/bar    │ │   │   │   │   │
        │header     │ │   │   │   │   │
        ├───────────┤ │   │   │   │   │
        │NAVBAR     │ │   │   │   │   │
        │TEMPLATE   │ │   │   │   │   │
        └───────────┘ │   │   │   │   │
                      │   │   │   │   │
              ┌───────┴─┐ │   │   │   │
              │/hero/   │ │   │   │   │
              │banner   │ │   │   │   │
              ├─────────┤ │   │   │   │
              │HERO     │ │   │   │   │
              │SECTION  │ │   │   │   │
              └─────────┘ │   │   │   │
                          │   │   │   │
                  ┌───────┴─┐ │   │   │
                  │/feature/│ │   │   │
                  ├─────────┤ │   │   │
                  │FEATURE  │ │   │   │
                  │CARDS    │ │   │   │
                  └─────────┘ │   │   │
                              │   │   │
                      ┌───────┴─┐ │   │
                      │/pricing/│ │   │
                      ├─────────┤ │   │
                      │PRICING  │ │   │
                      │TABLE    │ │   │
                      └─────────┘ │   │
                                  │   │
                          ┌───────┴─┐ │
                          │/test/   │ │
                          │/review/ │ │
                          ├─────────┤ │
                          │TESTIMONIAL
                          │SECTION  │ │
                          └─────────┘ │
                                      │
                              ┌───────┴─┐
                              │/stat/   │
                              │/metric/ │
                              ├─────────┤
                              │STATS    │
                              │SHOWCASE │
                              └─────────┘
```

---

**End of Architecture Diagrams**
