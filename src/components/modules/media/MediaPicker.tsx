"use client";

import React, { useState, useMemo } from "react";
import { ImageIcon, FileVideo, FileText, Search } from "lucide-react";

import MediaCard from "./MediaCard";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { type MediaFiles } from "@/lib/types";

interface MediaPickerProps {
  data: MediaFiles;
}

const getCategory = (file: { type?: string | null; link: string }) => {
  if (file.type) {
    if (file.type.startsWith("image/")) return "images";
    if (file.type.startsWith("video/")) return "videos";
    if (
      file.type.startsWith("application/") ||
      file.type.startsWith("text/")
    )
      return "documents";
  }

  // fallback using file extension
  const ext = file.link.split("?")[0].split(".").pop()?.toLowerCase() ?? "";

  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "bmp"].includes(ext))
    return "images";

  if (["mp4", "mov", "avi", "webm", "mkv", "m4v"].includes(ext))
    return "videos";

  if (
    ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"].includes(
      ext
    )
  )
    return "documents";

  return "other";
};


const MediaPicker: React.FC<MediaPickerProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  const media = data?.media ?? [];

  const filtered = useMemo(() => {
    return media.filter((file) => {
      const matchesSearch = file.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesTab =
        activeTab === "all" || getCategory(file) === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [media, search, activeTab]);

  return (
    <div className="flex flex-col h-full">

      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search media..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="p-3 border-b border-border">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="images">
              <ImageIcon className="w-4 h-4 mr-1" />
              Img
            </TabsTrigger>
            <TabsTrigger value="videos">
              <FileVideo className="w-4 h-4 mr-1" />
              Vid
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="w-4 h-4 mr-1" />
              Doc
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Media Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((file) => (
            <MediaCard key={file.id} file={file} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MediaPicker;
