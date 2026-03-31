"use client";

// src/components/modules/ai-builder/layout/AIWorkspace.tsx

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";

import ProjectSidebar from "../chat/ProjectSidebar";
import ChatPanel from "../chat/ChatPanel";
import LivePreview from "../preview/LivePreview";
import { useAIBuilderStore } from "../state/ai-builder.store";

const AIWorkspace = () => {
  const params = useParams();
  const subaccountId = params?.subaccountId as string;
  const projectId = params?.projectId as string;

  const { setProject, setFiles, files, projectId: storeProjectId } = useAIBuilderStore();
  const loadedRef = useRef<string | null>(null);

  // ── When navigating to a project, load its files from DB into the store ──
  // NOTE: We do NOT call mountAndRun here. LivePreview's useEffect handles
  // booting whenever `files` changes in the store. Calling mountAndRun from
  // two places caused a race condition where both used different hook instances
  // with separate `status`/`url` state, so the iframe never received the URL.
  useEffect(() => {
    if (!projectId || projectId === "new") return;
    if (loadedRef.current === projectId) return;

    // If the store already has this project's files (just generated), skip DB fetch
    if (storeProjectId === projectId && files.length > 0) {
      loadedRef.current = projectId;
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(`/api/ai/projects/${projectId}`);
        if (!res.ok) return;
        const data = await res.json();
        const loadedFiles = data?.project?.files ?? [];
        if (!loadedFiles.length) return;

        loadedRef.current = projectId;
        setProject(projectId);
        setFiles(loadedFiles); // ← LivePreview picks this up automatically
      } catch (err) {
        console.error("[AIWorkspace] Failed to load project files:", err);
      }
    };

    load();
  }, [projectId, storeProjectId, files.length, setProject, setFiles]);

  return (
    <div className="w-full h-full flex bg-background overflow-hidden">
      {/* 📁 PROJECTS SIDEBAR */}
      <div className="w-56 border-r shrink-0 overflow-hidden">
        <ProjectSidebar subaccountId={subaccountId} />
      </div>

      {/* 💬 CHAT PANEL */}
      <div className="w-[380px] border-r shrink-0 overflow-hidden">
        <ChatPanel />
      </div>

      {/* 👀 LIVE PREVIEW */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <LivePreview />
      </div>
    </div>
  );
};

export default AIWorkspace;