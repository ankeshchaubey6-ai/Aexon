//==================== FILE: src/lib/ai/engine/code-generator.ts ====================

import { AIFileNode, AIProjectPlan } from "../types/ai-project.types";

export class CodeGenerator {

  // ─────────────────────────────────────────────────────────────
  // BASIC GENERATION (SAFE FALLBACK)
  // ─────────────────────────────────────────────────────────────

  static generate(projectId: string, prompt: string): AIFileNode[] {
    const safeName = this.safeText(prompt?.slice(0, 40)) || "AI App";

    return [
      {
        path: "src/App.jsx",
        content: this.generateSafeApp(safeName),
        type: "file",
      },
      {
        path: "src/App.css",
        content: this.generateBaseCSS(),
        type: "file",
      },
      {
        path: "src/main.jsx",
        content: this.generateEntryPoint(),
        type: "file",
      },
    ];
  }

  // ─────────────────────────────────────────────────────────────
  // PLAN-BASED GENERATION (STRICT)
  // ─────────────────────────────────────────────────────────────

  static generateFromPlan(projectId: string, plan: AIProjectPlan): AIFileNode[] {
    if (!plan || !plan.projectName) {
      throw new Error("❌ Invalid plan: missing projectName");
    }

    const files: AIFileNode[] = [];

    const safePlan = this.sanitizePlan(plan);

    // App
    files.push({
      path: "src/App.jsx",
      content: this.generateAppComponent(safePlan),
      type: "file",
    });

    // CSS
    files.push({
      path: "src/App.css",
      content: this.generateStyles(),
      type: "file",
    });

    // Entry
    files.push({
      path: "src/main.jsx",
      content: this.generateEntryPoint(),
      type: "file",
    });

    // Components (validated)
    safePlan.components.forEach((component) => {
      const safeName = this.safeComponentName(component);

      files.push({
        path: `src/components/${safeName}.jsx`,
        content: this.generateComponent(safeName),
        type: "file",
      });
    });

    return files;
  }

  // ─────────────────────────────────────────────────────────────
  // GENERATORS
  // ─────────────────────────────────────────────────────────────

  private static generateAppComponent(plan: AIProjectPlan): string {
    const features = (plan.features || [])
      .map((f) => `<div className="feature">${this.safeText(f)}</div>`)
      .join("\n        ");

    return `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="app">
      <h1>${this.safeText(plan.projectName)}</h1>
      <p>${this.safeText(plan.description)}</p>
      <div className="features">
        ${features}
      </div>
    </div>
  );
}

export default App;`;
  }

  private static generateSafeApp(name: string): string {
    return `import React from 'react';

export default function App() {
  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>${name}</h1>
      <p>Pipeline working</p>
    </div>
  );
}`;
  }

  private static generateStyles(): string {
    return `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, sans-serif;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  min-height: 100vh;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px;
  text-align: center;
  color: white;
}

.features {
  display: grid;
  gap: 20px;
  margin-top: 40px;
}

.feature {
  background: rgba(255,255,255,0.1);
  padding: 20px;
  border-radius: 10px;
}`;
  }

  private static generateBaseCSS(): string {
    return `body { margin:0; font-family: system-ui; }`;
  }

  private static generateEntryPoint(): string {
    return `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
  }

  private static generateComponent(name: string): string {
    return `import React from 'react';

export default function ${name}() {
  return (
    <div className="${name.toLowerCase()}">
      <h2>${name} Component</h2>
    </div>
  );
}`;
  }

  // ─────────────────────────────────────────────────────────────
  // SANITIZATION (CRITICAL)
  // ─────────────────────────────────────────────────────────────

  private static sanitizePlan(plan: AIProjectPlan): AIProjectPlan {
    return {
      ...plan,
      projectName: this.safeText(plan.projectName),
      description: this.safeText(plan.description),
      components: (plan.components || []).map(this.safeComponentName),
      features: (plan.features || []).map(this.safeText),
    };
  }

  private static safeComponentName(name: string): string {
    const cleaned = name.replace(/[^a-zA-Z0-9]/g, "");
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1) || "Component";
  }

  private static safeText(text?: string): string {
    if (!text) return "";
    return text.replace(/[`$<>]/g, "");
  }
}