"use client";

// src/components/modules/ai-builder/chat/ProjectSidebar.tsx

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Plus, FolderOpen, Loader2 } from "lucide-react";

type ProjectMeta = {
  id: string;
  name: string;
  updatedAt: string;
};

const ProjectSidebar = ({ subaccountId }: { subaccountId: string }) => {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const activeProjectId = params?.projectId as string | undefined;

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/ai/projects?subaccountId=${subaccountId}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch (err) {
      console.error("[ProjectSidebar] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [subaccountId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Projects
        </span>
        <button
          onClick={() =>
            router.push(`/subaccount/${subaccountId}/ai-builder`)
          }
          title="All projects"
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* New project button */}
      <div className="px-3 py-2 shrink-0">
        <button
          onClick={() =>
            router.push(`/subaccount/${subaccountId}/ai-builder`)
          }
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs border border-dashed rounded-lg text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
        >
          <Plus className="h-3 w-3" />
          New Project
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 px-3">
            No projects yet
          </p>
        ) : (
          <div className="space-y-0.5 mt-1">
            {projects.map((p) => {
              const isActive = p.id === activeProjectId;
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    router.push(
                      `/subaccount/${subaccountId}/ai-builder/${p.id}`
                    )
                  }
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="block truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectSidebar;