// src/components/modules/ai-builder/layout/AIWorkspace.tsx (FINAL - store init + full wiring)
"use client";

import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";
import ChatSidebar from "../chat/ChatSidebar";
import FileExplorer from "../explorer/FileExplorer";
import MonacoEditor from "../editor/MonacoEditor";
import PreviewPanel from "../preview/PreviewPanel";
import AIToolbar from "./AIToolbar";
import AITabs from "./AITabs";

const AIWorkspace: React.FC = () => {
  const params = useParams();
  const projectIdFromRoute = params?.projectId as string | undefined;

  const { projectId, setProject } = useAIBuilderStore();
  const { status } = useWebContainer();

  useEffect(() => {
    if (projectIdFromRoute && !projectId) {
      setProject(projectIdFromRoute);
    }
  }, [projectIdFromRoute, projectId, setProject]);

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <AIToolbar />

      <div className="border-b px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Project: {projectId || "Initializing..."}
        </span>
        <span>Runtime: {status}</span>
      </div>

      <AITabs />

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <div className="col-span-2 border-r h-full bg-muted/20">
          <FileExplorer />
        </div>

        <div className="col-span-3 border-r h-full">
          <ChatSidebar />
        </div>

        <div className="col-span-4 border-r h-full">
          <MonacoEditor />
        </div>

        <div className="col-span-3 h-full">
          <PreviewPanel />
        </div>
      </div>
    </div>
  );
};

export default AIWorkspace;