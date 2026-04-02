// src/app/api/preview/route.ts
// GET /api/preview?projectId=xxx&subaccountId=yyy
//
// Opens as a full standalone page in a new browser tab.
// Fetches the project's files from DB and serves the built HTML,
// OR returns a loading shell that polls until the sandbox URL is ready.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return new NextResponse("Missing projectId", { status: 400 });
  }

  // ── 1. Load project + files from DB ──────────────────────────────────────
  let project: { name: string; files: { path: string; content: string }[] } | null = null;

  try {
    const row = await db.aIProject.findUnique({
      where: { id: projectId },
      include: { files: true },
    });

    if (row) {
      project = {
        name: row.name,
        files: (row.files ?? []).map((f: any) => ({
          path: f.path,
          content: f.content ?? "",
        })),
      };
    }
  } catch (err) {
    console.error("[preview] DB error:", err);
  }

  // ── 2. If no project found ────────────────────────────────────────────────
  if (!project) {
    return new NextResponse(notFoundHtml(projectId), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // ── 3. Find index.html in the files ──────────────────────────────────────
  //    For Vite/React projects the real entry is index.html at root.
  //    If the project is a React SPA we serve a shell that loads the
  //    compiled output — but since we're in WebContainer land, we just
  //    serve the raw index.html with a helpful message pointing to the
  //    in-app preview for the live dev server.
  const indexFile = project.files.find(
    (f) => f.path === "index.html" || f.path === "/index.html"
  );

  // ── 4. Serve full-page preview shell ─────────────────────────────────────
  const html = previewShell({
    projectName: project.name,
    projectId,
    indexHtml: indexFile?.content ?? null,
    fileList: project.files.map((f) => f.path),
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Prevent caching so refreshing always shows latest
      "Cache-Control": "no-store",
    },
  });
}

// ── HTML Templates ────────────────────────────────────────────────────────────

function previewShell({
  projectName,
  projectId,
  indexHtml,
  fileList,
}: {
  projectName: string;
  projectId: string;
  indexHtml: string | null;
  fileList: string[];
}) {
  // If this is a plain HTML project (no bundler), serve it directly
  if (indexHtml && !fileList.some((f) => f === "package.json")) {
    return indexHtml;
  }

  // For React/Vite projects: show a clean info page that explains the
  // live preview runs inside the AI Builder via WebContainer, and offers
  // a deep-link back to the builder workspace.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(projectName)} — Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #09090b;
      --surface: #0f0f11;
      --border: rgba(255,255,255,0.08);
      --text: #fafafa;
      --muted: rgba(255,255,255,0.4);
      --accent: #7c3aed;
      --accent2: #a855f7;
    }
    body {
      min-height: 100dvh;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      padding: 2rem;
    }
    .card {
      width: 100%;
      max-width: 480px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
    }
    .card-header {
      height: 3px;
      background: linear-gradient(90deg, #7c3aed, #a855f7, #06b6d4);
    }
    .card-body {
      padding: 2rem;
    }
    .icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: rgba(124,58,237,0.12);
      border: 1px solid rgba(124,58,237,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
      font-size: 22px;
    }
    h1 {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    p {
      font-size: 0.8125rem;
      color: var(--muted);
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: 10px;
      font-size: 0.8125rem;
      font-weight: 500;
      text-decoration: none;
      transition: opacity 0.15s;
      cursor: pointer;
    }
    .btn:hover { opacity: 0.85; }
    .btn-primary {
      background: linear-gradient(135deg, #7c3aed, #a855f7);
      color: #fff;
    }
    .btn-outline {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
      margin-left: 0.75rem;
    }
    .file-list {
      margin-top: 1.5rem;
      border-top: 1px solid var(--border);
      padding-top: 1.25rem;
    }
    .file-list-title {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 0.75rem;
    }
    .files {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }
    .file-pill {
      font-size: 0.6875rem;
      padding: 0.25rem 0.625rem;
      border-radius: 6px;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      color: var(--muted);
      font-family: monospace;
    }
    .note {
      font-size: 0.75rem;
      color: rgba(255,255,255,0.2);
      text-align: center;
      max-width: 400px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header"></div>
    <div class="card-body">
      <div class="icon">⚡</div>
      <h1>${escHtml(projectName)}</h1>
      <p>
        This is a React + Vite project generated by AI Builder. 
        The live interactive preview runs inside the AI Builder workspace 
        using a WebContainer — open the builder to see it running.
      </p>
      <div>
        <a class="btn btn-primary" href="javascript:history.back()">
          ← Back to Builder
        </a>
        <button class="btn btn-outline" onclick="copyId()">
          Copy Project ID
        </button>
      </div>
      <div class="file-list">
        <div class="file-list-title">${fileList.length} files in this project</div>
        <div class="files">
          ${fileList.slice(0, 20).map((f) => `<span class="file-pill">${escHtml(f)}</span>`).join("")}
          ${fileList.length > 20 ? `<span class="file-pill">+${fileList.length - 20} more</span>` : ""}
        </div>
      </div>
    </div>
  </div>
  <p class="note">
    Project ID: ${escHtml(projectId)}
  </p>
  <script>
    function copyId() {
      navigator.clipboard.writeText("${escHtml(projectId)}");
      event.target.textContent = "Copied!";
      setTimeout(() => event.target.textContent = "Copy Project ID", 2000);
    }
  </script>
</body>
</html>`;
}

function notFoundHtml(projectId: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Project not found</title>
  <style>
    body { background:#09090b; color:#fafafa; font-family:sans-serif; 
           display:flex; align-items:center; justify-content:center; 
           min-height:100dvh; flex-direction:column; gap:1rem; }
    p { color:rgba(255,255,255,0.4); font-size:0.875rem; }
    a { color:#a855f7; }
  </style>
</head>
<body>
  <h1 style="font-size:1.25rem">Project not found</h1>
  <p>No project with ID <code>${escHtml(projectId)}</code> was found.</p>
  <a href="javascript:history.back()">← Go back</a>
</body>
</html>`;
}

function escHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}