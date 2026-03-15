// src/lib/ai/engine/stack-config.ts
export const DEFAULT_STACK = {
  framework: "nextjs",
  styling: "tailwind",
  language: "typescript",
};

export const baseTemplateFiles = (projectName: string) => [
  {
    path: "package.json",
    content: JSON.stringify(
      {
        name: projectName.toLowerCase().replace(/\s+/g, "-"),
        private: true,
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
        },
        dependencies: {
          next: "14.2.0",
          react: "18.2.0",
          "react-dom": "18.2.0",
        },
      },
      null,
      2
    ),
  },
  {
    path: "app/page.tsx",
    content: `export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-3xl font-bold">
        AI Generated App Ready 🚀
      </h1>
    </main>
  );
}`,
  },
];