"use client";

// src/app/(main)/subaccount/[subaccountId]/ai-builder/AIBuilderClient.tsx

import React, { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, Plus, Code2, Clock, CalendarDays,
  MoreVertical, Trash2, ExternalLink, X, Loader2, FileCode2,
} from "lucide-react";
import { createAIProject, deleteAIProject } from "./actions";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type AIProject = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function formatRelative(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 30) return new Date(date).toLocaleDateString();
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const ACCENTS = [
  { from: "#7c3aed", to: "#a855f7" },
  { from: "#0891b2", to: "#06b6d4" },
  { from: "#059669", to: "#10b981" },
  { from: "#d97706", to: "#f59e0b" },
  { from: "#db2777", to: "#ec4899" },
  { from: "#4f46e5", to: "#6366f1" },
];

function accent(id: string) {
  return ACCENTS[id.charCodeAt(0) % ACCENTS.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PROJECT MODAL — calls server action directly, no fetch/API route
// ─────────────────────────────────────────────────────────────────────────────
function CreateProjectModal({
  subaccountId,
  onClose,
  onCreated,
}: {
  subaccountId: string;
  onClose: () => void;
  onCreated: (project: AIProject) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) { setError("Project name is required."); return; }

    startTransition(async () => {
      const result = await createAIProject(subaccountId, trimmed);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onCreated(result.project);
      router.push(`/subaccount/${subaccountId}/ai-builder/${result.project.id}`);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md mx-4 bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-[2px] w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500" />

        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <FileCode2 className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">New AI Project</h2>
              <p className="text-xs text-white/40 mt-0.5">Name your project to get started</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-widest">
              Project Name <span className="text-fuchsia-400">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing Landing Page"
              maxLength={80}
              disabled={isPending}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/60 transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              ⚠ {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-sm font-medium text-white transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
            >
              {isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</>
                : <><Sparkles className="w-3.5 h-3.5" /> Launch Builder</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// THUMBNAIL
// ─────────────────────────────────────────────────────────────────────────────
function ProjectThumbnail({ project }: { project: AIProject }) {
  const a = accent(project.id);
  const seed = project.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const bars = Array.from({ length: 4 }, (_, i) => ({
    w: 30 + ((seed * (i + 3)) % 50),
    y: 14 + i * 14,
  }));

  return (
    <svg viewBox="0 0 200 90" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="200" height="90" fill="#0a0a0c" />
      <defs>
        <radialGradient id={`g-${project.id}`} cx="30%" cy="30%" r="60%">
          <stop offset="0%" stopColor={a.from} stopOpacity="0.25" />
          <stop offset="100%" stopColor={a.to} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="90" fill={`url(#g-${project.id})`} />
      <rect x="8" y="8" width="184" height="10" rx="2" fill="white" fillOpacity="0.05" />
      <rect x="12" y="11" width="28" height="4" rx="1" fill={a.from} fillOpacity="0.7" />
      <rect x="160" y="11" width="12" height="4" rx="1" fill="white" fillOpacity="0.1" />
      <rect x="175" y="11" width="12" height="4" rx="1" fill="white" fillOpacity="0.1" />
      {bars.map((b, i) => (
        <rect key={i} x="12" y={b.y + 10} width={b.w} height="4" rx="1"
          fill={i === 0 ? a.from : "white"} fillOpacity={i === 0 ? 0.6 : 0.08} />
      ))}
      <rect x="110" y="22" width="78" height="56" rx="4" fill="white" fillOpacity="0.04"
        stroke="white" strokeOpacity="0.06" strokeWidth="0.5" />
      <rect x="118" y="30" width="40" height="5" rx="1" fill={a.to} fillOpacity="0.5" />
      <rect x="118" y="39" width="55" height="3" rx="1" fill="white" fillOpacity="0.07" />
      <rect x="118" y="45" width="48" height="3" rx="1" fill="white" fillOpacity="0.05" />
      <rect x="118" y="55" width="30" height="8" rx="2" fill={a.from} fillOpacity="0.4" />
      <rect x="12" y="68" width="85" height="2" rx="1" fill="white" fillOpacity="0.04" />
      <rect x="12" y="73" width="60" height="2" rx="1" fill="white" fillOpacity="0.04" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT CARD
// ─────────────────────────────────────────────────────────────────────────────
function ProjectCard({
  project,
  subaccountId,
  onDeleted,
}: {
  project: AIProject;
  subaccountId: string;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const a = accent(project.id);

  const openProject = () =>
    router.push(`/subaccount/${subaccountId}/ai-builder/${project.id}`);

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAIProject(subaccountId, project.id);
      if ("success" in result) onDeleted(project.id);
    });
  };

  return (
    <div
      className="group relative bg-[#0f0f11] border border-white/8 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300 hover:shadow-2xl cursor-pointer flex flex-col"
      onClick={openProject}
    >
      <div className="relative h-[90px] overflow-hidden bg-[#0a0a0c] shrink-0">
        <ProjectThumbnail project={project} />

        <button
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/50 border border-white/10 text-white/40 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        >
          <MoreVertical className="w-3 h-3" />
        </button>

        {menuOpen && (
          <div
            className="absolute top-8 right-1.5 w-40 bg-[#1c1c20] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-white/60 hover:bg-white/5 hover:text-white transition-colors"
              onClick={() => { setMenuOpen(false); openProject(); }}
            >
              <ExternalLink className="w-3 h-3" /> Open Builder
            </button>
            <div className="h-px bg-white/5 mx-2" />
            {confirmDelete ? (
              <div className="p-2 flex flex-col gap-1.5">
                <p className="text-[10px] text-red-400 px-1">Delete this project?</p>
                <div className="flex gap-1.5">
                  <button
                    className="flex-1 py-1.5 text-[10px] rounded-lg border border-white/10 text-white/40 hover:text-white/60 transition-colors"
                    onClick={() => setConfirmDelete(false)}
                  >Cancel</button>
                  <button
                    className="flex-1 py-1.5 text-[10px] rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    onClick={handleDelete}
                    disabled={isPending}
                  >{isPending ? "…" : "Delete"}</button>
                </div>
              </div>
            ) : (
              <button
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4 gap-2">
        <h3 className="text-sm font-semibold text-white truncate">
          <span
            className="group-hover:text-transparent group-hover:bg-clip-text transition-all"
            style={{ backgroundImage: `linear-gradient(90deg, ${a.from}, ${a.to})`, WebkitBackgroundClip: "text" }}
          >
            {project.name}
          </span>
        </h3>

        {project.description && (
          <p className="text-xs text-white/30 line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}

        <div className="flex flex-col gap-1 mt-auto pt-3 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] text-white/25">
            <CalendarDays className="w-3 h-3 shrink-0" />
            <span>Created {formatDate(project.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/25">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Edited {formatRelative(project.updatedAt)}</span>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-[1.5px] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, ${a.from}, ${a.to})` }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function AIBuilderClient({
  subaccountId,
  initialProjects,
}: {
  subaccountId: string;
  initialProjects: AIProject[];
}) {
  const [projects, setProjects] = useState<AIProject[]>(initialProjects);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_-10%,rgba(120,80,255,0.07),transparent)]" />

      <div className="relative max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              AI Builder
            </h1>
            <p className="text-xs text-white/30 mt-1">
              {projects.length === 0
                ? "No projects yet — create your first"
                : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 border border-dashed border-white/8 rounded-2xl text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Code2 className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">No projects yet</p>
              <p className="text-xs text-white/30 mt-1 max-w-xs">
                Create your first AI project and generate a full React app from a single prompt.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Create First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                subaccountId={subaccountId}
                onDeleted={(id) => setProjects((prev) => prev.filter((p) => p.id !== id))}
              />
            ))}
            <button
              onClick={() => setShowModal(true)}
              className="group border border-dashed border-white/8 hover:border-violet-500/40 rounded-2xl min-h-[200px] flex flex-col items-center justify-center gap-2 text-white/20 hover:text-violet-400 transition-all"
            >
              <div className="w-10 h-10 rounded-xl border border-dashed border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium">New Project</span>
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <CreateProjectModal
          subaccountId={subaccountId}
          onClose={() => setShowModal(false)}
          onCreated={(project) => setProjects((prev) => [project, ...prev])}
        />
      )}
    </div>
  );
}