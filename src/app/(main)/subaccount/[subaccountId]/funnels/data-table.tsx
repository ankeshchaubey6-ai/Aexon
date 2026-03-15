"use client";

import React, { useState, useMemo } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Crown,
  Activity,
  Clock,
  ChevronRight,
  BarChart3,
  Award,
  Zap,
  PlusCircle,
  Eye,
  TrendingUp,
  Funnel,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useModal } from "@/hooks/use-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CustomModal from "@/components/common/CustomModal";

interface FunnelData {
  id: string;
  name: string;
  published: boolean;
  subDomainName?: string | null;
  createdAt: Date;
  updatedAt: Date;
  subAccountId: string;
}

interface FunnelsDataTableProps<TData extends FunnelData, TValue> {
  subaccountId: string;
  subaccountName: string;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  stats: {
    totalFunnels: number;
    publishedFunnels: number;
    draftFunnels: number;
  };
  filterValue: string;
  actionButtonText?: React.ReactNode;
  modalChildren?: React.ReactNode;
}

// ── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
  iconColor,
  subtext,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  subtext?: string;
}) => (
  <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all duration-300">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-white/50">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {subtext && (
          <p className="text-xs text-white/30 mt-1">{subtext}</p>
        )}
      </div>
      <div className={`p-2 rounded-lg bg-gradient-to-r ${color}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
export default function FunnelsDataTable<TData extends FunnelData, TValue>({
  subaccountId,
  subaccountName,
  columns,
  data,
  stats,
  filterValue,
  modalChildren,
  actionButtonText,
}: FunnelsDataTableProps<TData, TValue>) {
  const router = useRouter();
  const { setOpen } = useModal();
  const [activeTab, setActiveTab] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Funnels refreshed");
    }, 800);
  };

  const handleExport = () => {
    const exportData = data.map(f => ({
      name: f.name,
      status: f.published ? "Published" : "Draft",
      subDomain: f.subDomainName || "-",
      created: new Date(f.createdAt).toLocaleDateString(),
    }));

    const csv = [
      ["Name", "Status", "Subdomain", "Created"],
      ...exportData.map(row => [row.name, row.status, row.subDomain, row.created]),
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `funnels-${subaccountName}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Funnels exported");
  };

  const filteredData = useMemo(() => {
    if (activeTab === "published") return data.filter(f => f.published);
    if (activeTab === "draft") return data.filter(f => !f.published);
    return data;
  }, [data, activeTab]);

  const publishedPct = Math.round((stats.publishedFunnels / (stats.totalFunnels || 1)) * 100);
  const draftPct = Math.round((stats.draftFunnels / (stats.totalFunnels || 1)) * 100);

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

      {/* Premium Header - COMPACT SIZE like Settings/Contacts */}
      <div className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#DB2777] opacity-90 animate-gradient-x"
          style={{
            backgroundSize: "200% 200%",
          }}
        />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />

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
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity" />
                <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl">
                  <Funnel className="w-5 h-5 text-white" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">Funnels</h1>
                  <Badge className="bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-white border-white/10 backdrop-blur-sm px-2 py-0.5 text-xs">
                    <Crown className="w-3 h-3 mr-1 text-amber-300" />
                    {subaccountName}
                  </Badge>
                </div>
                <p className="text-white/70 text-xs flex items-center">
                  Create and manage your sales funnels
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
                  <Activity className="w-3.5 h-3.5 text-white/60" />
                  <span className="text-xs font-medium text-white">{stats.publishedFunnels}</span>
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
              { icon: Funnel, label: "Funnels", active: true, color: "from-purple-500 to-pink-600" },
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
                  <Zap className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-medium text-emerald-400">{stats.totalFunnels} FUNNELS</span>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Total Funnels"
            value={stats.totalFunnels}
            icon={Funnel}
            color="from-blue-500/20 to-cyan-500/20"
            iconColor="text-blue-400"
            subtext={`${stats.totalFunnels} total workspaces`}
          />
          <StatCard
            title="Published"
            value={stats.publishedFunnels}
            icon={CheckCircle2}
            color="from-emerald-500/20 to-teal-500/20"
            iconColor="text-emerald-400"
            subtext={`${publishedPct}% conversion rate`}
          />
          <StatCard
            title="Draft"
            value={stats.draftFunnels}
            icon={Eye}
            color="from-amber-500/20 to-orange-500/20"
            iconColor="text-amber-400"
            subtext={`${draftPct}% awaiting publish`}
          />
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="bg-white/5 border border-white/10">
              {[
                { val: "all", label: "All", count: stats.totalFunnels },
                { val: "published", label: "Published", count: stats.publishedFunnels },
                { val: "draft", label: "Draft", count: stats.draftFunnels },
              ].map(({ val, label, count }) => (
                <TabsTrigger
                  key={val}
                  value={val}
                  className={[
                    "text-xs data-[state=active]:text-white data-[state=active]:shadow-none",
                    val === "all"
                      ? "data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#4F46E5] data-[state=active]:to-[#7C3AED]"
                      : val === "published"
                      ? "data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500"
                      : "data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500",
                  ].join(" ")}
                >
                  {label}
                  <span className="ml-1.5 text-[9px] opacity-70">{count}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
              <Input
                placeholder="Search funnels..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  table.getColumn(filterValue)?.setFilterValue(e.target.value);
                }}
                className="pl-9 pr-8 py-1.5 w-64 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-lg text-xs h-8"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    table.getColumn(filterValue)?.setFilterValue("");
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
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
                <DropdownMenuLabel className="text-xs">Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setActiveTab("all")}>
                  <CheckCircle2 className="w-3 h-3 mr-2 text-indigo-400" />
                  All ({stats.totalFunnels})
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setActiveTab("published")}>
                  Published ({stats.publishedFunnels})
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setActiveTab("draft")}>
                  Draft ({stats.draftFunnels})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Button */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/5 h-8 px-2"
              onClick={handleExport}
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">Export</span>
            </Button>

            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/5 h-8 px-2"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="text-xs">Sync</span>
            </Button>

            {/* Create Funnel Button - Using global blue color */}
            <Button
              className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4F46E5]/90 hover:to-[#7C3AED]/90 text-white h-8 px-3 shadow-lg shadow-[#4F46E5]/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => {
                if (modalChildren)
                  setOpen(
                    <CustomModal
                      title="Create a Funnel"
                      subTitle="Funnels are like websites, but better! Try creating one!"
                    >
                      {modalChildren}
                    </CustomModal>
                  );
              }}
            >
              {actionButtonText}
            </Button>
          </div>
        </div>

        {/* Results Count */}
        {filteredData.length > 0 && (
          <p className="text-[10px] text-white/30 mb-3">
            Showing {filteredData.length} of {data.length} funnels
            {searchQuery && ` matching "${searchQuery}"`}
            {activeTab !== "all" && ` • ${activeTab}`}
          </p>
        )}

        {/* Data Table */}
        <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="border-white/10 hover:bg-white/5">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-white/30 text-xs py-3 px-4">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {filteredData.length ? (
                  filteredData.map((row) => {
                    const rowModel = table.getRowModel().rows.find(r => r.original.id === row.id);
                    if (!rowModel) return null;
                    return (
                      <TableRow
                        key={row.id}
                        className="border-white/10 hover:bg-white/5 transition-colors"
                      >
                        {rowModel.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="text-white text-sm py-3 px-4">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-32 text-center text-white/30 text-sm"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Funnel className="w-8 h-8 text-white/20 mb-2" />
                        <p>
                          {searchQuery 
                            ? "No matching funnels found" 
                            : activeTab !== "all" 
                              ? `No ${activeTab} funnels yet` 
                              : "No funnels found. Create your first funnel to get started."}
                        </p>
                        {data.length === 0 && (
                          <Button
                            className="mt-4 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4F46E5]/90 hover:to-[#7C3AED]/90 text-white h-8 px-3"
                            onClick={() => {
                              if (modalChildren)
                                setOpen(
                                  <CustomModal
                                    title="Create a Funnel"
                                    subTitle="Funnels are like websites, but better! Try creating one!"
                                  >
                                    {modalChildren}
                                  </CustomModal>
                                );
                            }}
                          >
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Create Funnel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
}