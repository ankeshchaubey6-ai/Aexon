"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  Search,
  Sparkles,
  ChevronRight,
  Award,
  Clock,
  TrendingUp,
  LayoutDashboard,
  Users,
  Zap,
  Activity,
  Shield,
  Mail,
  Phone,
  MapPin,
  Calendar,
  MoreVertical,
  Edit,
  Copy,
  ExternalLink,
  Settings,
  UserPlus,
  Filter,
  Download,
  Grid3x3,
  List,
  Crown,
  Eye,
  Trash2,
  RefreshCw,
  ArrowUpRight,
  DollarSign,
  Target,
  Plus,
  X,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import DeleteButton from "./_components/DeleteButton";
import CreateButton from "./_components/CreateButton";

/* ───────────────── TYPES ───────────────── */

interface SubAccount {
  id: string;
  name: string;
  address?: string | null;
  subAccountLogo?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  createdAt?: Date;
  goal?: number;
}

interface Props {
  agencyId: string;
  user: any;
  subAccounts: SubAccount[];
}

/* ───────────────── COMPONENT ───────────────── */

export default function AllSubAccountsClient({
  agencyId,
  user,
  subAccounts,
}: Props) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return subAccounts;

    return subAccounts.filter((sa) => {
      return (
        sa.name?.toLowerCase().includes(q) ||
        sa.address?.toLowerCase().includes(q) ||
        sa.companyEmail?.toLowerCase().includes(q) ||
        sa.companyPhone?.toLowerCase().includes(q) ||
        sa.id?.toLowerCase().includes(q)
      );
    });
  }, [query, subAccounts]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (index: number) => {
    const colors = ['from-emerald-500 to-teal-500', 'from-blue-500 to-cyan-500', 'from-amber-500 to-orange-500', 'from-purple-500 to-pink-500'];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0F1E] via-[#0F1425] to-[#0A0F1E]">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#4F46E5]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#7C3AED]/20 rounded-full blur-3xl animate-pulse animation-delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#DB2777]/10 rounded-full blur-3xl animate-pulse animation-delay-2000" />
      </div>

      {/* Premium Header - COMPACT VERSION matching reference */}
      <div className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#DB2777] opacity-90 animate-gradient-x bg-[length:200%_200%]" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />
        
        {/* Glass overlay */}
        <div className="absolute inset-0 backdrop-blur-[2px]" />
        
        {/* Floating particles */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse animation-delay-1000" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Top Bar - Compact */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Icon */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity" />
                <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">Subaccounts</h1>
                  <Badge className="bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-white border-white/10 backdrop-blur-sm px-2 py-0.5 text-xs">
                    <Crown className="w-3 h-3 mr-1 text-amber-300" />
                    Enterprise
                  </Badge>
                </div>
                <p className="text-white/70 text-xs flex items-center">
                  Manage and monitor all your subaccounts
                  <ChevronRight className="w-3 h-3 ml-1 text-white/40" />
                </p>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
                  <span className="text-xs text-white/80">Active</span>
                </div>
                <Separator orientation="vertical" className="h-4 bg-white/20" />
                <div className="flex items-center space-x-1">
                  <Activity className="w-3.5 h-3.5 text-white/60" />
                  <span className="text-xs font-medium text-white">{subAccounts.length}</span>
                </div>
              </div>

              {/* Time Indicator */}
              <div className="hidden md:flex items-center space-x-2 bg-white/5 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10">
                <Clock className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs text-white/80">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Pills */}
          <div className="flex items-center gap-1.5 mt-4">
            {[
              { icon: LayoutDashboard, label: 'Overview', active: true, color: 'from-indigo-500 to-purple-600' },
              { icon: Building2, label: 'Subaccounts', active: false, color: 'from-purple-500 to-pink-600' },
              { icon: Users, label: 'Team', active: false, color: 'from-pink-500 to-rose-600' },
              { icon: Zap, label: 'Integrations', active: false, color: 'from-amber-500 to-orange-600' },
            ].map((item, index) => (
              <button
                key={index}
                className={`group relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 overflow-hidden ${
                  item.active
                    ? 'text-white shadow-lg'
                    : 'text-white/60 hover:text-white'
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
                  <>
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-300" />
                    <div className="absolute inset-0 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                  </>
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

            {/* Premium Badges */}
            <div className="ml-auto flex items-center gap-2">
              <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <Award className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-medium text-amber-400">PRO</span>
                </div>
              </div>
              <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-medium text-emerald-400">{subAccounts.length} ACTIVE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subtle Gradient Line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Total Revenue',
              value: '$124.5k',
              icon: DollarSign,
              change: '+12.3%',
              color: 'from-emerald-500 to-teal-500'
            },
            {
              label: 'Active Projects',
              value: '48',
              icon: Target,
              change: '+8',
              color: 'from-blue-500 to-cyan-500'
            },
            {
              label: 'Team Members',
              value: '24',
              icon: Users,
              change: '+3',
              color: 'from-purple-500 to-pink-500'
            },
            {
              label: 'Success Rate',
              value: '94%',
              icon: Activity,
              change: '+5.2%',
              color: 'from-amber-500 to-orange-500'
            }
          ].map((stat, idx) => (
            <Card key={idx} className="border-0 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/50">{stat.label}</p>
                    <p className="text-xl font-bold text-white mt-1">{stat.value}</p>
                    <p className="text-xs text-emerald-400 mt-1 flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-1" />
                      {stat.change}
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${stat.color} bg-opacity-20`}>
                    <stat.icon className="w-4 h-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Tabs defaultValue="all" className="w-auto" onValueChange={setFilterStatus}>
            <TabsList className="bg-white/5 border border-white/10">
              <TabsTrigger value="all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#4F46E5] data-[state=active]:to-[#7C3AED] data-[state=active]:text-white">
                All
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white">
                Active
              </TabsTrigger>
              <TabsTrigger value="pending" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white">
                Pending
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
              <button
                onClick={() => setView("grid")}
                className={`p-2 rounded-md transition-all ${
                  view === "grid" 
                    ? "bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-2 rounded-md transition-all ${
                  view === "list" 
                    ? "bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/5">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1A1F3A] border-white/10 text-white">
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem>All</DropdownMenuItem>
                <DropdownMenuItem>Active</DropdownMenuItem>
                <DropdownMenuItem>Pending</DropdownMenuItem>
                <DropdownMenuItem>Suspended</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Button */}
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/5">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>

            {/* Create Button */}
            <CreateButton user={user} agencyId={agencyId} />
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, phone, address, or ID..."
            className="w-full pl-12 pr-4 py-3 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl focus:ring-2 focus:ring-[#4F46E5]/50 transition-all text-base"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Subaccounts Grid/List */}
        {filtered.length > 0 ? (
          view === "grid" ? (
            // Grid View
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((sub, idx) => (
                <SubAccountCard 
                  key={sub.id} 
                  subAccount={sub} 
                  index={idx}
                  getInitials={getInitials}
                  getStatusColor={getStatusColor}
                />
              ))}
            </div>
          ) : (
            // List View
            <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardContent className="p-0">
                <div className="divide-y divide-white/10">
                  {filtered.map((sub, idx) => (
                    <SubAccountListItem 
                      key={sub.id} 
                      subAccount={sub} 
                      index={idx}
                      getInitials={getInitials}
                      getStatusColor={getStatusColor}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          <EmptyState query={query} />
        )}
      </div>

      <style>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animate-gradient-x {
          animation: gradient-x 15s ease infinite;
        }
      `}</style>
    </div>
  );
}

/* ───────── SUBACCOUNT CARD (GRID VIEW) ───────── */

function SubAccountCard({ subAccount, index, getInitials, getStatusColor }: any) {
  return (
    <AlertDialog>
      <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden group hover:scale-[1.02] transition-all duration-300">
        <CardContent className="p-0">
          <div className="p-5 relative">
            {/* Hover Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5]/0 via-[#7C3AED]/0 to-[#DB2777]/0 group-hover:from-[#4F46E5]/5 group-hover:via-[#7C3AED]/5 group-hover:to-[#DB2777]/5 transition-all duration-500" />
            
            <div className="relative">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-xl blur-md opacity-0 group-hover:opacity-50 transition-opacity" />
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-[#1A1F3A] to-[#0F1425] border border-white/10 group-hover:border-white/20 transition-all">
                      {subAccount.subAccountLogo ? (
                        <Image
                          src={subAccount.subAccountLogo}
                          alt={subAccount.name}
                          fill
                          className="object-contain p-2"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#4F46E5] to-[#7C3AED]">
                          <span className="text-white text-lg font-bold">
                            {getInitials(subAccount.name)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{subAccount.name}</h3>
                    <p className="text-xs text-white/40">ID: {subAccount.id.slice(0, 8)}...</p>
                  </div>
                </div>

                <Badge className={`bg-gradient-to-r ${getStatusColor(index)} text-white border-0 text-xs`}>
                  <Activity className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                {subAccount.address && (
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{subAccount.address}</span>
                  </div>
                )}
                {subAccount.companyEmail && (
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{subAccount.companyEmail}</span>
                  </div>
                )}
                {subAccount.companyPhone && (
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Phone className="w-3 h-3" />
                    <span>{subAccount.companyPhone}</span>
                  </div>
                )}
              </div>

              {/* Progress */}
              {subAccount.goal && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/40">Progress</span>
                    <span className="text-white">65%</span>
                  </div>
                  <Progress value={65} className="h-1 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-[#4F46E5] [&>div]:to-[#7C3AED]" />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs text-white/30">
                  <Calendar className="w-3 h-3" />
                  Created {subAccount.createdAt ? new Date(subAccount.createdAt).toLocaleDateString() : 'N/A'}
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/subaccount/${subAccount.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/40 hover:text-white">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href={`/subaccount/${subAccount.id}/settings`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/40 hover:text-white">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </Link>
                  
                  {/* Delete Button with AlertDialog */}
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400/40 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <AlertDialogContent className="bg-gradient-to-br from-[#1A1F3A] to-[#0F1425] border-white/10">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white text-lg flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-500">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            Delete Sub Account
          </AlertDialogTitle>
          <AlertDialogDescription className="text-white/60">
            This action cannot be undone. This will permanently delete{' '}
            <span className="text-white font-semibold">{subAccount.name}</span>{' '}
            and all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400 flex items-center gap-2">
            <span className="w-1 h-1 bg-red-400 rounded-full" />
            This includes all projects, team members, and historical data
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/5 text-white border-white/10 hover:bg-white/10 hover:text-white">
            Cancel
          </AlertDialogCancel>
          <DeleteButton subAccountId={subAccount.id} />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ───────── SUBACCOUNT LIST ITEM (LIST VIEW) ───────── */

function SubAccountListItem({ subAccount, index, getInitials, getStatusColor }: any) {
  return (
    <AlertDialog>
      <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
        <Link href={`/subaccount/${subAccount.id}`} className="flex items-center gap-4 flex-1">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-lg blur-md opacity-0 group-hover:opacity-50 transition-opacity" />
            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-[#1A1F3A] to-[#0F1425] border border-white/10">
              {subAccount.subAccountLogo ? (
                <Image
                  src={subAccount.subAccountLogo}
                  alt={subAccount.name}
                  fill
                  className="object-contain p-1.5"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#4F46E5] to-[#7C3AED]">
                  <span className="text-white text-sm font-bold">
                    {getInitials(subAccount.name)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-white font-medium">{subAccount.name}</p>
              <p className="text-xs text-white/40">{subAccount.id.slice(0, 8)}</p>
            </div>
            <div className="text-white/70 truncate">{subAccount.address || 'No address'}</div>
            <div className="text-white/70 truncate">{subAccount.companyEmail || 'No email'}</div>
            <div className="text-white/70">{subAccount.companyPhone || 'No phone'}</div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Badge className={`bg-gradient-to-r ${getStatusColor(index)} text-white border-0 text-xs`}>
            <Activity className="w-3 h-3 mr-1" />
            Active
          </Badge>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white/40 hover:text-white">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1A1F3A] border-white/10 text-white">
              <DropdownMenuItem className="hover:bg-white/5">
                <Edit className="w-3 h-3 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-white/5">
                <Copy className="w-3 h-3 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-white/5">
                <ExternalLink className="w-3 h-3 mr-2" /> View
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <AlertDialogTrigger asChild>
                <DropdownMenuItem className="text-red-400 hover:bg-red-500/10">
                  <Trash2 className="w-3 h-3 mr-2" /> Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AlertDialogContent className="bg-gradient-to-br from-[#1A1F3A] to-[#0F1425] border-white/10">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white text-lg flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-500">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            Delete Sub Account
          </AlertDialogTitle>
          <AlertDialogDescription className="text-white/60">
            This action cannot be undone. This will permanently delete{' '}
            <span className="text-white font-semibold">{subAccount.name}</span>{' '}
            and all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400 flex items-center gap-2">
            <span className="w-1 h-1 bg-red-400 rounded-full" />
            This includes all projects, team members, and historical data
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/5 text-white border-white/10 hover:bg-white/10 hover:text-white">
            Cancel
          </AlertDialogCancel>
          <DeleteButton subAccountId={subAccount.id} />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ───────── EMPTY STATE ───────── */

function EmptyState({ query }: { query?: string }) {
  return (
    <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl">
      <CardContent className="p-12 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#4F46E5]/20 to-[#7C3AED]/20 flex items-center justify-center">
          {query ? (
            <Search className="w-8 h-8 text-white/40" />
          ) : (
            <Building2 className="w-8 h-8 text-white/40" />
          )}
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          {query ? `No results for "${query}"` : "No Subaccounts Yet"}
        </h3>
        <p className="text-white/50 text-sm max-w-md mx-auto mb-6">
          {query 
            ? "Try adjusting your search or filter to find what you're looking for."
            : "Get started by creating your first subaccount. You can manage multiple brands or business units under your agency."}
        </p>
      </CardContent>
    </Card>
  );
}