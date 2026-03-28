"use client";

import { useState } from "react";
import { WebContainer } from "@webcontainer/api";

let webcontainerInstance: WebContainer | null = null;

export const useWebContainer = () => {
  const [status, setStatus] = useState("idle");
  const [url, setUrl] = useState<string | null>(null);

  // =========================
  // 🚀 BOOT CONTAINER
  // =========================
  const boot = async () => {
    if (webcontainerInstance) return webcontainerInstance;

    setStatus("booting...");
    webcontainerInstance = await WebContainer.boot();
    setStatus("ready");

    return webcontainerInstance;
  };

  // =========================
  // 📁 FILE TREE BUILDER
  // =========================
  const buildFileTree = (files: { path: string; content: string }[]) => {
    const tree: Record<string, any> = {};

    files.forEach((file) => {
      const parts = file.path.split("/");
      let current = tree;

      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = {
            file: {
              contents: file.content,
            },
          };
        } else {
          if (!current[part]) {
            current[part] = { directory: {} };
          }
          current = current[part].directory;
        }
      });
    });

    return tree;
  };

  // =========================
  // ✏️ WRITE FILES (for edits — no restart needed)
  // Writes updated files directly into the running container.
  // Vite HMR picks up the changes automatically.
  // =========================
  const writeFiles = async (files: { path: string; content: string }[]) => {
    if (!webcontainerInstance) {
      console.warn("⚠️ writeFiles called but container is not running");
      return;
    }

    try {
      await Promise.all(
        files.map(async (file) => {
          // Ensure parent directories exist
          const parts = file.path.split("/");
          if (parts.length > 1) {
            const dir = parts.slice(0, -1).join("/");
            await webcontainerInstance!.fs.mkdir(dir, { recursive: true });
          }

          await webcontainerInstance!.fs.writeFile(file.path, file.content);
        })
      );

      console.log(`✅ Wrote ${files.length} file(s) into container`);
    } catch (err) {
      console.error("❌ writeFiles error:", err);
    }
  };

  // =========================
  // 🔥 MAIN RUN FUNCTION (initial mount only)
  // =========================
  const mountAndRun = async (files: any[]) => {
    try {
      const wc = await boot();

      setUrl(null);

      // =========================
      // 📦 MOUNT FILES
      // =========================
      setStatus("mounting...");
      await wc.mount(buildFileTree(files));

      // =========================
      // 📦 INSTALL
      // =========================
      const hasPackageJson = files.some((f) => f.path === "package.json");

      if (hasPackageJson) {
        setStatus("installing...");

        const install = await wc.spawn("npm", ["install"]);

        install.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log("[npm install]", data);
            },
          })
        );

        await install.exit;
      }

      // =========================
      // 🚀 START DEV SERVER
      // =========================
      setStatus("starting...");

      const dev = await wc.spawn("npm", ["run", "dev"]);

      dev.output.pipeTo(
        new WritableStream({
          write(data) {
            console.log("[dev]", data);
          },
        })
      );

      // =========================
      // 🌐 SERVER READY
      // =========================
      wc.on("server-ready", (port, url) => {
        console.log("SERVER READY:", url);
        setUrl(url);
        setStatus("running");
      });
    } catch (err) {
      console.error("WebContainer Error:", err);
      setStatus("error");
    }
  };

  return {
    status,
    url,
    mountAndRun,
    writeFiles,
  };
};