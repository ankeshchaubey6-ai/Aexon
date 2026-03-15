// src/components/modules/ai-builder/state/use-webcontainer.ts
"use client";

import { useEffect, useState } from "react";

export const useWebContainer = () => {
  const [status, setStatus] = useState<
    "idle" | "booting" | "ready" | "error"
  >("idle");

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        setStatus("booting");
        await new Promise((res) => setTimeout(res, 800));
        if (mounted) setStatus("ready");
      } catch {
        if (mounted) setStatus("error");
      }
    };

    boot();

    return () => {
      mounted = false;
    };
  }, []);

  return { status };
};