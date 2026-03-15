"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  MoreVertical,
  Trash2,
  Eye,
  Calendar,
  ExternalLink,
  Loader2,
  Download,
  Link2,
  ImageIcon,
  FileVideo,
  FileText,
  File,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { type Media } from "@prisma/client";

import { deleteMedia } from "@/queries/media";
import { saveActivityLogsNotification } from "@/queries/notifications";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";

// ── Helpers ───────────────────────────────────────────────────────────────────

const isImage = (file: Media) => {
  if (file.type?.startsWith("image/")) return true;
  const ext = file.link.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return ["jpg","jpeg","png","gif","webp","svg","avif","bmp"].includes(ext);
};

const isVideo = (file: Media) => {
  if (file.type?.startsWith("video/")) return true;
  const ext = file.link.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return ["mp4","mov","avi","webm","mkv"].includes(ext);
};

const getLabel = (file: Media) => {
  if (file.type) {
    const sub = file.type.split("/")[1]?.toUpperCase();
    if (sub) return sub;
  }
  return file.link.split("?")[0].split(".").pop()?.toUpperCase() ?? "FILE";
};

const formatBytes = (bytes?: number | null) => {
  if (!bytes) return null;
  const k = 1024, sizes = ["B","KB","MB","GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// Category colour accents
const getAccent = (file: Media) => {
  if (isImage(file)) return { ring: "group-hover:ring-blue-500/40",   badge: "bg-blue-500/20 text-blue-300 border-blue-500/20",   icon: "text-blue-400"   };
  if (isVideo(file)) return { ring: "group-hover:ring-purple-500/40", badge: "bg-purple-500/20 text-purple-300 border-purple-500/20", icon: "text-purple-400" };
  return                     { ring: "group-hover:ring-amber-500/40",  badge: "bg-amber-500/20 text-amber-300 border-amber-500/20",   icon: "text-amber-400"  };
};

const FilePlaceholder = ({ file }: { file: Media }) => {
  const { icon } = getAccent(file);
  const Icon = isVideo(file) ? FileVideo : isImage(file) ? ImageIcon : FileText;
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
      <div className={`p-3 rounded-2xl bg-white/5 border border-white/10`}>
        <Icon className={`w-8 h-8 ${icon}`} />
      </div>
      <span className="text-[10px] text-white/30 font-medium tracking-wider uppercase">
        {getLabel(file)}
      </span>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const MediaCard: React.FC<{ file: Media }> = ({ file }) => {
  const router = useRouter();
  const [isDeleting, setIsDeleting]     = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const accent = getAccent(file);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await deleteMedia(file.id);
      await saveActivityLogsNotification({
        agencyId: undefined,
        description: `Deleted a media file | ${response?.name}`,
        subAccountId: response.subAccountId,
      });
      toast.success("File deleted");
      router.refresh();
    } catch {
      toast.error("Could not delete file");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(file.link);
    toast.success("Link copied");
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = file.link;
    a.download = file.name;
    a.click();
  };

  return (
    <>
      {/* ── Card ── */}
      <AlertDialog>
        <div
          className={[
            "group relative w-full flex flex-col rounded-2xl overflow-hidden",
            "bg-[#0F1425] border border-white/[0.07]",
            "ring-1 ring-transparent transition-all duration-300",
            "hover:border-white/[0.15] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            accent.ring,
          ].join(" ")}
        >
          {/* ── Thumbnail ── */}
          <div className="relative w-full aspect-[4/3] overflow-hidden bg-[#080C18]">
            {isImage(file) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.link}
                alt={file.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : isVideo(file) ? (
              <div className="relative w-full h-full">
                <video
                  src={file.link}
                  className="w-full h-full object-cover opacity-70"
                  muted
                  preload="metadata"
                />
                {/* Play icon overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
                <FilePlaceholder file={file} />
              </div>
            ) : (
              <FilePlaceholder file={file} />
            )}

            {/* Gradient fog at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0F1425] to-transparent" />

            {/* Type badge — top left */}
            <Badge className={`absolute top-2.5 left-2.5 text-[9px] font-semibold px-1.5 py-0.5 border backdrop-blur-sm ${accent.badge}`}>
              {getLabel(file)}
            </Badge>

            {/* Hover action strip — top right */}
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="h-7 w-7 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-7 w-7 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-colors">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 bg-[#0F1425]/95 backdrop-blur-xl border-white/10 text-white shadow-xl rounded-xl">
                  <DropdownMenuLabel className="text-[10px] text-white/40 uppercase tracking-widest font-semibold px-2 py-1.5">
                    Options
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuItem className="text-xs gap-2 cursor-pointer rounded-lg hover:bg-white/5 focus:bg-white/5 focus:text-white" onClick={handleCopy}>
                    <Link2 className="w-3.5 h-3.5 text-white/50" /> Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs gap-2 cursor-pointer rounded-lg hover:bg-white/5 focus:bg-white/5 focus:text-white" onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5 text-white/50" /> Download
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs gap-2 cursor-pointer rounded-lg hover:bg-white/5 focus:bg-white/5 focus:text-white" onClick={() => window.open(file.link, "_blank")}>
                    <ExternalLink className="w-3.5 h-3.5 text-white/50" /> Open original
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/5" />
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-xs gap-2 cursor-pointer rounded-lg text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ── Info footer ── */}
          <div className="px-3 pt-2 pb-3 flex flex-col gap-1.5">
            <p className="text-[12px] font-medium text-white/85 truncate leading-tight">
              {file.name}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px] text-white/30">
                <Calendar className="w-2.5 h-2.5" />
                {format(new Date(file.createdAt), "dd MMM yyyy")}
              </div>
              {formatBytes(file.size) && (
                <div className="flex items-center gap-1 text-[10px] text-white/25">
                  <HardDrive className="w-2.5 h-2.5" />
                  {formatBytes(file.size)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Delete dialog ── */}
        <AlertDialogContent className="bg-[#0F1425]/95 backdrop-blur-2xl border-white/10 rounded-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/15 border border-red-500/20">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              Delete file?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/50 text-sm">
              Permanently remove{" "}
              <span className="text-white/80 font-medium">{file.name}</span>.
              Any pages linking to this file will show broken images.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="bg-white/5 hover:bg-white/10 border-white/10 text-white rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleDelete}
              className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white border-0 rounded-xl disabled:opacity-50"
            >
              {isDeleting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Deleting…</>
                : "Delete file"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Preview dialog ── */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-5xl w-full bg-[#080C18]/98 border-white/10 p-0 overflow-hidden rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.8)]">
          {/* Header bar */}
          <DialogHeader className="absolute top-0 inset-x-0 z-20 px-5 pt-4 pb-8 bg-gradient-to-b from-black/90 to-transparent">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-white/90 text-sm font-medium truncate max-w-xs">
                {file.name}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white/70 hover:text-white text-xs transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy link
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white/70 hover:text-white text-xs transition-colors"
                >
                  <Download className="w-3 h-3" /> Download
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Media area */}
          <div className="relative w-full min-h-[60vh] flex items-center justify-center bg-[#050810]">
            {isImage(file) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.link}
                alt={file.name}
                className="max-w-full max-h-[75vh] object-contain"
              />
            ) : isVideo(file) ? (
              <video
                src={file.link}
                controls
                autoPlay
                className="max-w-full max-h-[75vh]"
              />
            ) : (
              <div className="flex flex-col items-center gap-4 py-16 text-white/30">
                <File className="w-16 h-16" />
                <p className="text-sm">Preview not available</p>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-colors"
                >
                  <Download className="w-4 h-4" /> Download to view
                </button>
              </div>
            )}
          </div>

          {/* Footer meta */}
          <div className="px-5 py-3 bg-black/60 border-t border-white/5 flex items-center gap-4 text-[11px] text-white/35">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(file.createdAt), "dd MMM yyyy, hh:mm a")}</span>
            {formatBytes(file.size) && <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{formatBytes(file.size)}</span>}
            <Badge className={`ml-auto text-[9px] px-1.5 py-0.5 border ${accent.badge}`}>{getLabel(file)}</Badge>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MediaCard;