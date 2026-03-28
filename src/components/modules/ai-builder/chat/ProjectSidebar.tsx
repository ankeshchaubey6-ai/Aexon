"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAIProjects } from "@/queries/ai-projects";

const ProjectSidebar = ({ subaccountId }: { subaccountId: string }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const res = await getAIProjects(subaccountId);
      setProjects(res);
    };

    load();
  }, [subaccountId]);

  return (
    <div className="h-full p-3 flex flex-col">
      
      <h2 className="text-sm font-semibold mb-3">
        Projects
      </h2>

      <button
        onClick={() =>
          router.push(`/subaccount/${subaccountId}/ai-builder/new`)
        }
        className="mb-3 text-xs px-2 py-1 border rounded"
      >
        + New Project
      </button>

      <div className="flex-1 overflow-y-auto space-y-2">
        {projects.map((p) => (
          <div
            key={p.id}
            onClick={() =>
              router.push(
                `/subaccount/${subaccountId}/ai-builder/${p.id}`
              )
            }
            className="p-2 border rounded cursor-pointer hover:bg-muted text-xs"
          >
            {p.name}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectSidebar;