// src/lib/ai/engine/code-generator.ts (FINAL FIX - add required "type" field)
import { AIFileNode } from "../types/ai-project.types";
import { baseTemplateFiles } from "./stack-config";
import { ProjectPlanner } from "./project-planner";

export class CodeGenerator {
  static generate(projectId: string, prompt: string): AIFileNode[] {
    const plan = ProjectPlanner.plan(prompt);

    const baseFiles = baseTemplateFiles(plan.name).map(
      (file): AIFileNode => ({
        path: file.path,
        content: file.content,
        type: "file",
      })
    );

    const files: AIFileNode[] = [
      ...baseFiles,
      {
        path: "README.md",
        content: `# ${plan.name}

Generated with AI Builder.
Project ID: ${projectId}

Prompt:
${prompt}
`,
        type: "file",
      },
    ];

    plan.pages.forEach((page: string) => {
      if (page === "home") return;

      files.push({
        path: `app/${page}/page.tsx`,
        content: `export default function ${page
          .charAt(0)
          .toUpperCase()}${page.slice(1)}Page() {
  return (
    <div className="p-10">
      <h1 className="text-2xl font-semibold capitalize">
        ${page} Page
      </h1>
    </div>
  );
}`,
        type: "file",
      });
    });

    return files;
  }
}