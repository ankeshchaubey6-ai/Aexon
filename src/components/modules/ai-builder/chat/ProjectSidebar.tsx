"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Plus,
  FolderOpen,
  Loader2,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="h-full flex flex-col bg-background border-r">
      {/* HEADER */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Explorer
        </span>

        <button
          onClick={() =>
            router.push(`/subaccount/${subaccountId}/ai-builder`)
          }
          className="p-1 rounded hover:bg-muted transition"
        >
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* NEW PROJECT */}
      <div className="px-2 py-2">
        <button
          onClick={() =>
            router.push(`/subaccount/${subaccountId}/ai-builder`)
          }
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md border border-dashed text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/40 transition"
        >
          <Plus className="h-3 w-3" />
          New Project
        </button>
      </div>

      {/* LIST */}
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 px-3">
            No projects yet
          </p>
        ) : (
          <div className="mt-1">
            {projects.map((p) => {
              const isActive = p.id === activeProjectId;

              return (
                <div
                  key={p.id}
                  onClick={() =>
                    router.push(
                      `/subaccount/${subaccountId}/ai-builder/${p.id}`
                    )
                  }
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-all",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {/* ICON */}
                  <Folder className="h-3.5 w-3.5 shrink-0" />

                  {/* NAME */}
                  <span className="truncate flex-1">
                    {p.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectSidebar;