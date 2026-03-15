// src/lib/ai/engine/project-planner.ts
export class ProjectPlanner {
  static plan(prompt: string) {
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

    return {
      name: "ai-generated-app",
      pages: ["home"],
    };
  }
}