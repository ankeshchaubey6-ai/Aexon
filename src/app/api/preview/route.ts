import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { files } = await req.json();

    const pageFile = files.find(
      (f: any) => f.path === "app/page.tsx"
    );

    if (!pageFile) {
      return NextResponse.json({
        html: "<h1>No page.tsx found</h1>",
      });
    }

    // ⚠️ TEMP SIMPLE RENDER (Phase 2)
    const html = `
      <html>
        <head>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="p-10 font-sans">
          <div>
            <h1 class="text-2xl font-bold mb-4">Preview</h1>
            <pre>${pageFile.content
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")}</pre>
          </div>
        </body>
      </html>
    `;

    return NextResponse.json({ html });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      html: "<h1>Preview Error</h1>",
    });
  }
}