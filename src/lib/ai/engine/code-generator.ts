//==================== FILE: src/lib/ai/engine/code-generator.ts ====================

// src/lib/ai/engine/code-generator.ts
import { AIFileNode, AIProjectPlan } from "../types/ai-project.types";

export class CodeGenerator {
  static generate(projectId: string, prompt: string): AIFileNode[] {
    const timestamp = new Date().toISOString();
    const projectName = prompt.slice(0, 40) || "AI Generated App";
    
    return [
      {
        path: "src/App.jsx",
        content: `...`, // Same content as before
        type: "file"
      },
      {
        path: "src/App.css",
        content: `...`, // Same content as before
        type: "file"
      },
      {
        path: "src/main.jsx",
        content: `...`, // Same content as before
        type: "file"
      }
    ];
  }

  static generateFromPlan(projectId: string, plan: AIProjectPlan): AIFileNode[] {
    // Generate project based on detailed plan
    const files: AIFileNode[] = [];
    
    // Generate main App component
    files.push({
      path: "src/App.jsx",
      content: this.generateAppComponent(plan),
      type: "file"
    });
    
    // Generate CSS
    files.push({
      path: "src/App.css",
      content: this.generateStyles(plan),
      type: "file"
    });
    
    // Generate main entry
    files.push({
      path: "src/main.jsx",
      content: this.generateEntryPoint(),
      type: "file"
    });
    
    // Generate additional components
    plan.components.forEach(component => {
      files.push({
        path: `src/components/${component}.jsx`,
        content: this.generateComponent(component),
        type: "file"
      });
    });
    
    return files;
  }

  private static generateAppComponent(plan: AIProjectPlan): string {
    return `
import React from 'react';
import './App.css';

function App() {
  return (
    <div className="app">
      <h1>${plan.projectName}</h1>
      <p>${plan.description}</p>
      <div className="features">
        ${plan.features.map(f => `<div className="feature">${f}</div>`).join('\n        ')}
      </div>
    </div>
  );
}

export default App;
    `;
  }

  private static generateStyles(plan: AIProjectPlan): string {
    return `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px;
  text-align: center;
  color: white;
}

h1 {
  font-size: 3rem;
  margin-bottom: 20px;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 40px;
}

.feature {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 20px;
  border-radius: 10px;
}
    `;
  }

  private static generateEntryPoint(): string {
    return `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
    `;
  }

  private static generateComponent(name: string): string {
    return `
import React from 'react';

export default function ${name}() {
  return (
    <div className="${name.toLowerCase()}">
      <h2>${name} Component</h2>
    </div>
  );
}
    `;
  }
}


