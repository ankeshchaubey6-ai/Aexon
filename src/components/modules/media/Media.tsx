"use client";

import React, { useState, useMemo } from "react";
import {
  FolderOpen,
  ImageIcon,
  HardDrive,
  Search,
  Crown,
  Activity,
  Clock,
  ChevronRight,
  Filter,
  Grid3x3,
  List,
  FileVideo,
  FileText,
  Award,
  LayoutDashboard,
  Settings,
  BarChart3,
  Users,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import MediaUploadButton from "./MediaUploadButton";
import MediaCard from "./MediaCard";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Separator } from "../../ui/separator";
import { Progress } from "../../ui/progress";
import { Tabs, TabsList, TabsTrigger } from "../../ui/tabs";
import { Card, CardContent } from "../../ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

import { type MediaFiles } from "@/lib/types";

interface MediaProps {
  subAccountId: string;
  data: MediaFiles;
}

const formatBytes = (bytes: number = 0, decimals = 2) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

// ── Detect file category from type or link extension ─────────────────────────
const getCategory = (file: { type?: string | null; link: string }): string => {
  if (file.type) {
    if (file.type.startsWith("image/")) return "images";
    if (file.type.startsWith("video/")) return "videos";
    if (file.type.startsWith("application/") || file.type.startsWith("text/")) return "documents";
  }
  // Fallback: sniff from URL
  const ext = file.link.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (["jpg","jpeg","png","gif","webp","svg","avif","bmp"].includes(ext)) return "images";
  if (["mp4","mov","avi","webm","mkv","m4v"].includes(ext)) return "videos";
  if (["pdf","doc","docx","xls","xlsx","ppt","pptx","txt","csv"].includes(ext)) return "documents";
  return "other";
};

const Media: React.FC<MediaProps> = ({ subAccountId, data }) => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const media = data?.media ?? [];

  const totalFiles = media.length;
  const totalSize = media.reduce((acc, f) => acc + (f.size ?? 0), 0);
  const imagesCount = media.filter(f => getCategory(f) === "images").length;
  const videosCount = media.filter(f => getCategory(f) === "videos").length;
  const documentsCount = media.filter(f => getCategory(f) === "documents").length;

  const storageLimit = 1024 * 1024 * 1024;
  const storageUsedPercent = Math.min(100, Math.round((totalSize / storageLimit) * 100));

  const filteredMedia = useMemo(() => {
    return media.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === "all" || getCategory(file) === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [media, searchQuery, activeTab]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0F1E] via-[#0F1425] to-[#0A0F1E] relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#4F46E5]/20 rounded-full blur-3xl animate-pulse" />
        <div 
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#7C3AED]/20 rounded-full blur-3xl animate-pulse" 
          style={{ animationDelay: "1s" }}
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#DB2777]/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* Premium Header - EXACT SIZE like Settings/Contacts */}
      <div className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div 
          className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#DB2777] opacity-90 animate-gradient-x"
          style={{
            backgroundSize: "200% 200%",
          }}
        />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse" />
          <div 
            className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" 
            style={{ animationDelay: "1s" }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Top Bar - Compact */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Icon */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity" />
                <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl">
                  <ImageIcon className="w-5 h-5 text-white" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">Media Bucket</h1>
                  <Badge className="bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-white border-white/10 backdrop-blur-sm px-2 py-0.5 text-xs">
                    <Crown className="w-3 h-3 mr-1 text-amber-300" />
                    {totalFiles} Files
                  </Badge>
                </div>
                <p className="text-white/70 text-xs flex items-center">
                  Manage and organize your media assets
                  <ChevronRight className="w-3 h-3 ml-1 text-white/40" />
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
                  <span className="text-xs text-white/80">Live</span>
                </div>
                <Separator orientation="vertical" className="h-4 bg-white/20" />
                <div className="flex items-center space-x-1">
                  <HardDrive className="w-3.5 h-3.5 text-white/60" />
                  <span className="text-xs font-medium text-white">
                    {formatBytes(totalSize)}
                  </span>
                </div>
              </div>

              <div className="hidden md:flex items-center space-x-2 bg-white/5 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10">
                <Clock className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs text-white/80">
                  {new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Pills */}
          <div className="flex items-center gap-1.5 mt-4">
            {[
              { icon: LayoutDashboard, label: "Dashboard", active: false, color: "from-indigo-500 to-purple-600" },
              { icon: ImageIcon, label: "Media", active: true, color: "from-purple-500 to-pink-600" },
              { icon: Settings, label: "Settings", active: false, color: "from-pink-500 to-rose-600" },
              { icon: BarChart3, label: "Analytics", active: false, color: "from-amber-500 to-orange-600" },
            ].map((item, index) => (
              <button
                key={index}
                className={`group relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 overflow-hidden ${
                  item.active
                    ? "text-white shadow-lg"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {item.active && (
                  <>
                    <div className={`absolute inset-0 bg-gradient-to-r ${item.color} opacity-100`} />
                    <div className="absolute inset-0 bg-white/20 backdrop-blur-sm mix-blend-overlay" />
                    <div className="absolute inset-0 shadow-inner shadow-white/20" />
                  </>
                )}
                {!item.active && (
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-300" />
                )}
                <span className="relative flex items-center gap-1.5">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </span>
                {item.active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-lg shadow-white/50" />
                )}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <Award className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-medium text-amber-400">PRO</span>
                </div>
              </div>
              <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-medium text-emerald-400">{formatBytes(totalSize)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subtle Gradient Line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard title="Total Files" value={totalFiles} icon={FolderOpen} color="from-blue-500/20 to-cyan-500/20" iconColor="text-blue-400" />
          <StatCard title="Total Size" value={formatBytes(totalSize)} icon={HardDrive} color="from-emerald-500/20 to-teal-500/20" iconColor="text-emerald-400" />
          <StatCard title="Images" value={imagesCount} icon={ImageIcon} color="from-purple-500/20 to-pink-500/20" iconColor="text-purple-400" />
          <StatCard title="Videos" value={videosCount} icon={FileVideo} color="from-amber-500/20 to-orange-500/20" iconColor="text-amber-400" />
          <StatCard title="Documents" value={documentsCount} icon={FileText} color="from-red-500/20 to-rose-500/20" iconColor="text-red-400" />
        </div>

        {/* Storage Progress */}
        {totalFiles > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/40">Storage Used</span>
              <span className="text-[10px] text-white/60">
                {formatBytes(totalSize)} / 1 GB
              </span>
            </div>
            <Progress
              value={storageUsedPercent}
              className="h-1 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-[#4F46E5] [&>div]:to-[#7C3AED]"
            />
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="bg-white/5 border border-white/10">
              {[
                { val: "all", label: "All" },
                { val: "images", label: "Images" },
                { val: "videos", label: "Videos" },
                { val: "documents", label: "Documents" },
              ].map(({ val, label }) => (
                <TabsTrigger
                  key={val}
                  value={val}
                  className="text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#4F46E5] data-[state=active]:to-[#7C3AED] data-[state=active]:text-white"
                >
                  {label}
                  {val !== "all" && (
                    <span className="ml-1.5 text-[9px] opacity-70">
                      {val === "images" ? imagesCount : val === "videos" ? videosCount : documentsCount}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "grid" 
                    ? "bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Grid3x3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "list" 
                    ? "bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/5 h-8 px-2">
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  <span className="text-xs">Filter</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1A1F3A] border-white/10 text-white">
                <DropdownMenuLabel className="text-xs">Filter by Type</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                {["all", "images", "videos", "documents"].map((type) => (
                  <DropdownMenuItem
                    key={type}
                    className="text-xs cursor-pointer capitalize"
                    onClick={() => setActiveTab(type)}
                  >
                    {activeTab === type && (
                      <CheckCircle2 className="w-3 h-3 mr-2 text-indigo-400" />
                    )}
                    {type === "all" ? "All Files" : type}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-white/60 hover:text-white hover:bg-white/5 h-8 px-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="text-xs">Sync</span>
            </Button>

            <MediaUploadButton subAccountId={subAccountId} />
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          <Input
            placeholder="Search files by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-10 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-lg focus:ring-purple-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results Count */}
        {media.length > 0 && (
          <p className="text-[10px] text-white/30 mb-3">
            Showing {filteredMedia.length} of {media.length} files
            {searchQuery && ` matching "${searchQuery}"`}
            {activeTab !== "all" && ` • ${activeTab}`}
          </p>
        )}

        {/* Media Grid/List */}
        {filteredMedia.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredMedia.map((file) => (
                <MediaCard key={file.id} file={file}  />
              ))}
            </div>
          ) : (
            <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardContent className="p-0 divide-y divide-white/10">
                {filteredMedia.map((file) => (
                  <MediaCard key={file.id} file={file} />
                ))}
              </CardContent>
            </Card>
          )
        ) : (
          <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#4F46E5]/20 to-[#7C3AED]/20 flex items-center justify-center">
                {searchQuery || activeTab !== "all" ? (
                  <Search className="w-8 h-8 text-white/40" />
                ) : (
                  <FolderOpen className="w-8 h-8 text-white/40" />
                )}
              </div>
              <h3 className="text-white font-medium mb-2">
                {media.length === 0 
                  ? "Your media bucket is empty" 
                  : searchQuery 
                    ? "No matching files found"
                    : activeTab !== "all"
                      ? `No ${activeTab} files yet`
                      : "No files in this category"}
              </h3>
              <p className="text-xs text-white/30 max-w-md mx-auto">
                {media.length === 0
                  ? "Upload your first file to get started."
                  : searchQuery
                    ? "Try adjusting your search term"
                    : activeTab !== "all"
                      ? `You don't have any ${activeTab} files yet.`
                      : ""}
              </p>
              {media.length === 0 && (
                <div className="mt-4">
                  <MediaUploadButton subAccountId={subAccountId} />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <style>{`
        @keyframes gradient-x {
          0%,100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          animation: gradient-x 15s ease infinite;
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
};

export default Media;

const StatCard = ({ title, value, icon: Icon, color, iconColor }: any) => (
  <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[10px] text-white/50">{title}</p>
        <p className="text-base font-bold text-white mt-0.5">{value}</p>
      </div>
      <div className={`p-1.5 rounded-lg bg-gradient-to-r ${color}`}>
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      </div>
    </div>
  </div>
);