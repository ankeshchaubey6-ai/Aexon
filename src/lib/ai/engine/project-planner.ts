//==================== FILE: src/lib/ai/engine/project-planner.ts ====================

// src/lib/ai/engine/project-planner.ts
//
// Stage 1 wrapper — delegates to the pipeline's kimi-k2-instruct planner.
// Kept as a class so the rest of the codebase can call
// ProjectPlanner.planFromPrompt() without importing pipeline.ts directly.
//

import { planProject } from "@/lib/ai/llm/pipeline";

export interface BasicPlan {
  name: string;
  pages: string[];
}

export class ProjectPlanner {
  // ─────────────────────────────────────────────
  // Full AI plan via kimi-k2-instruct (Stage 1)
  // Returns the full ProjectSpec used by the pipeline,
  // or null if planning fails.
  // ─────────────────────────────────────────────
  static async planFromPrompt(prompt: string) {
    return planProject(prompt);
  }

  // ─────────────────────────────────────────────
  // Quick local heuristic — zero-latency fallback.
  // Used when you need an instant structural hint
  // without waiting for a network call.
  // ─────────────────────────────────────────────
  static plan(prompt: string): BasicPlan {
    const lower = prompt.toLowerCase();

    if (lower.includes("landing")) {
      return {
        name: "ai-landing-app",
        pages: ["home", "pricing", "contact"],
      };
    }

    if (lower.includes("dashboard")) {
      return {
        name: "ai-dashboard-app",
        pages: ["dashboard", "analytics", "settings"],
      };
    }

    if (lower.includes("blog")) {
      return {
        name: "ai-blog-app",
        pages: ["home", "post", "about"],
      };
    }

    if (lower.includes("portfolio")) {
      return {
        name: "ai-portfolio-app",
        pages: ["home", "projects", "contact"],
      };
    }

    if (lower.includes("ecommerce") || lower.includes("shop")) {
      return {
        name: "ai-shop-app",
        pages: ["home", "products", "cart", "checkout"],
      };
    }

    return {
      name: "ai-generated-app",
      pages: ["home"],
    };
  }
}


