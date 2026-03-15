"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Crown,
  Search,
  Filter,
  Download,
  MoreVertical,
  ChevronRight,
  Activity,
  Clock,
  RefreshCw,
  Settings,
  TrendingUp,
  Sparkles,
  Calendar,
  Building2,
  UserCircle,
  MessageCircle,
  UserCog,
  Key,
  Copy,
  Trash2,
  X,
  CheckCircle2,
  ArrowUpRight,
  ChevronDown,
  Plus
} from "lucide-react";
import { Role } from "@prisma/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import SendInvitation from "@/components/forms/SendInvitation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: Role | null;
}

interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl: string;
}

interface AgencyDetails {
  id: string;
  name: string;
  [key: string]: any;
}

interface TeamClientProps {
  agencyId: string;
  authUser: AuthUser;
  teamMembers: TeamMember[];
  agencyDetails: AgencyDetails;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const getRoleBadgeColor = (role: Role | null) => {
  switch (role) {
    case Role.AGENCY_OWNER:
      return 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30';
    case Role.AGENCY_ADMIN:
      return 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30';
    case Role.SUBACCOUNT_USER:
      return 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30';
    case Role.SUBACCOUNT_GUEST:
      return 'bg-gradient-to-r from-slate-500/20 to-stone-500/20 text-slate-400 border-slate-500/30';
    default:
      return 'bg-gradient-to-r from-slate-500/20 to-stone-500/20 text-slate-400 border-slate-500/30';
  }
};

const getRoleLabel = (role: Role | null) => {
  switch (role) {
    case Role.AGENCY_OWNER: return 'Agency Owner';
    case Role.AGENCY_ADMIN: return 'Admin';
    case Role.SUBACCOUNT_USER: return 'User';
    case Role.SUBACCOUNT_GUEST: return 'Guest';
    default: return 'No Role';
  }
};

const statusColors = ["bg-emerald-500", "bg-blue-500", "bg-amber-500"];

// ─── Main Client Component ────────────────────────────────────────────────────

export default function TeamClient({
  agencyId,
  authUser,
  teamMembers,
  agencyDetails,
}: TeamClientProps) {
  // ── state ──
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "admins" | "active">("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [inviteOpen, setInviteOpen] = useState(false);

  // ── derived ──
  const admins = teamMembers.filter(
    (m) => m.role === Role.AGENCY_ADMIN || m.role === Role.AGENCY_OWNER
  ).length;

  const filtered = useMemo(() => {
    let list = [...teamMembers];

    // tab filter
    if (activeTab === "admins")
      list = list.filter((m) => m.role === Role.AGENCY_ADMIN || m.role === Role.AGENCY_OWNER);
    if (activeTab === "active")
      list = list.filter((m) => m.role !== null);

    // role dropdown filter
    if (filterRole !== "all")
      list = list.filter((m) => m.role === filterRole);

    // search
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (getRoleLabel(m.role).toLowerCase().includes(q))
      );
    }

    return list;
  }, [teamMembers, query, activeTab, filterRole]);

  const getClerkInitials = () =>
    `${authUser.firstName[0] ?? ""}${authUser.lastName[0] ?? ""}`.toUpperCase();

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
        {/* Animated gradient background with noise texture */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#DB2777] opacity-90 animate-gradient-x bg-[length:200%_200%]" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />
        
        {/* Advanced glass overlay */}
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
              {/* Premium 3D Icon with Neumorphism */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity" />
                <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl">
                  <Users className="w-5 h-5 text-white" />
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">Team</h1>
                  <Badge className="bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-white border-white/10 backdrop-blur-sm px-2 py-0.5 text-xs">
                    <Crown className="w-3 h-3 mr-1 text-amber-300" />
                    {agencyDetails.name}
                  </Badge>
                </div>
                <p className="text-white/70 text-xs flex items-center">
                  Manage your team members, roles, and permissions
                  <ChevronRight className="w-3 h-3 ml-1 text-white/40" />
                </p>
              </div>
            </div>
            
            {/* Quick Stats - Compact Glass Card */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
                  <span className="text-xs text-white/80">Active</span>
                </div>
                <Separator orientation="vertical" className="h-4 bg-white/20" />
                <div className="flex items-center space-x-1">
                  <Activity className="w-3.5 h-3.5 text-white/60" />
                  <span className="text-xs font-medium text-white">{teamMembers.filter((m) => m.role !== null).length}</span>
                </div>
              </div>

              {/* Premium Time Indicator */}
              <div className="hidden md:flex items-center space-x-2 bg-white/5 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10">
                <Clock className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs text-white/80">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Pills - Compact with Advanced Effects */}
          <div className="flex items-center gap-1.5 mt-4">
            {[
              { icon: Users, label: 'All Members', active: activeTab === 'all', color: 'from-indigo-500 to-purple-600' },
              { icon: Shield, label: 'Admins', active: activeTab === 'admins', color: 'from-purple-500 to-pink-600' },
              { icon: Activity, label: 'Active', active: activeTab === 'active', color: 'from-emerald-500 to-teal-600' },
              { icon: UserPlus, label: 'Invites', active: false, color: 'from-amber-500 to-orange-600' },
            ].map((item, index) => (
              <button
                key={index}
                onClick={() => setActiveTab(item.label === 'All Members' ? 'all' : item.label === 'Admins' ? 'admins' : item.label === 'Active' ? 'active' : activeTab)}
                className={`group relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 overflow-hidden ${
                  item.active
                    ? 'text-white shadow-lg'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {/* Background Effects */}
                {item.active && (
                  <>
                    <div className={`absolute inset-0 bg-gradient-to-r ${item.color} opacity-100`} />
                    <div className="absolute inset-0 bg-white/20 backdrop-blur-sm mix-blend-overlay" />
                    <div className="absolute inset-0 shadow-inner shadow-white/20" />
                  </>
                )}
                
                {/* Hover Effect */}
                {!item.active && (
                  <>
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-300" />
                    <div className="absolute inset-0 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                  </>
                )}
                
                {/* Content */}
                <span className="relative flex items-center gap-1.5">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </span>

                {/* Active Indicator */}
                {item.active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-lg shadow-white/50" />
                )}
              </button>
            ))}

            {/* Premium Badges */}
            <div className="ml-auto flex items-center gap-2">
              <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-medium text-amber-400">{admins} ADMINS</span>
                </div>
              </div>
              <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-medium text-emerald-400">{teamMembers.length} TOTAL</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subtle Gradient Line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>

      {/* Main Content - Rest of your code remains exactly the same */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              {/* User Profile Card */}
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A] to-[#0F1425] shadow-2xl overflow-hidden group">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12 ring-2 ring-[#4F46E5]/30">
                        <AvatarImage src={authUser.imageUrl} />
                        <AvatarFallback className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white text-sm">
                          {getClerkInitials()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#A5B4FC]">Signed in as</p>
                      <p className="text-sm font-semibold text-white truncate">
                        {authUser.firstName} {authUser.lastName}
                      </p>
                      <p className="text-xs text-white/50 truncate">
                        {authUser.email}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Agency Info Card */}
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/80 to-[#0F1425]/80 backdrop-blur-xl shadow-2xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-lg">
                      <Building2 className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Agency Details</h3>
                  </div>
                  
                  <div className="flex items-center space-x-2 mb-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white text-xs">
                        {agencyDetails.name?.charAt(0).toUpperCase() || 'A'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-white">{agencyDetails.name}</p>
                      <p className="text-[10px] text-white/40">ID: {agencyId?.slice(0, 6)}...</p>
                    </div>
                  </div>

                  {/* Mini Stats */}
                  <div className="grid grid-cols-3 gap-1 mt-2">
                    {[
                      { label: 'Projects', value: '12', color: 'from-blue-500 to-cyan-500' },
                      { label: 'Team', value: teamMembers.length, color: 'from-purple-500 to-pink-500' },
                      { label: 'Admins', value: admins, color: 'from-amber-500 to-orange-500' },
                    ].map((stat, i) => (
                      <div key={i} className="text-center p-1 rounded-lg bg-white/5">
                        <div className={`text-xs font-bold text-transparent bg-gradient-to-r ${stat.color} bg-clip-text`}>
                          {stat.value}
                        </div>
                        <div className="text-[8px] text-white/40">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl">
                <CardContent className="p-2">
                  {[
                    { icon: Users, label: 'All Members', key: 'all', active: activeTab === 'all', gradient: 'from-[#4F46E5] to-[#7C3AED]' },
                    { icon: Shield, label: 'Admins', key: 'admins', active: activeTab === 'admins', gradient: 'from-[#EC4899] to-[#DB2777]' },
                    { icon: Activity, label: 'Active', key: 'active', active: activeTab === 'active', gradient: 'from-[#10B981] to-[#059669]' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setActiveTab(item.key as any)}
                      className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg transition-all duration-200 relative group ${
                        item.active ? 'text-white' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {item.active && (
                        <>
                          <div className={`absolute inset-0 bg-gradient-to-r ${item.gradient} rounded-lg opacity-20`} />
                          <div className="absolute inset-0 bg-white/5 backdrop-blur-sm rounded-lg" />
                        </>
                      )}
                      {!item.active && (
                        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-lg transition-all duration-200" />
                      )}
                      <div className="relative flex items-center space-x-2 w-full">
                        <div className={`p-1 rounded-md ${
                          item.active 
                            ? `bg-gradient-to-r ${item.gradient}` 
                            : 'bg-white/10'
                        }`}>
                          <item.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-medium flex-1 text-left">{item.label}</span>
                        {item.active && (
                          <Sparkles className="w-3 h-3 text-white/60" />
                        )}
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Team Stats Card */}
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#4F46E5]" />
                    Team Overview
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/40">Role Distribution</span>
                        <span className="text-white/60">{admins} Admins • {teamMembers.length - admins} Members</span>
                      </div>
                      <Progress value={(admins / teamMembers.length) * 100} className="h-1 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-[#4F46E5] [&>div]:to-[#7C3AED]" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/40">Team Goal</span>
                        <span className="text-white/60">{teamMembers.length}/20</span>
                      </div>
                      <Progress value={(teamMembers.length / 20) * 100} className="h-1 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content - Team Members Grid */}
          <div className="lg:col-span-3">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <Tabs defaultValue="all" className="w-auto" onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="bg-[#1A1F3A]/90 border border-white/10">
                  <TabsTrigger value="all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#4F46E5] data-[state=active]:to-[#7C3AED] data-[state=active]:text-white">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="active" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white">
                    Active
                  </TabsTrigger>
                  <TabsTrigger value="admins" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white">
                    Admins
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    placeholder="Search members..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 w-64 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-lg"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/5">
                      <Filter className="w-4 h-4 mr-2" />
                      Filter
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#1A1F3A] border-white/10 text-white">
                    <DropdownMenuLabel>Filter by Role</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={() => setFilterRole("all")}>
                      All Roles
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterRole(Role.AGENCY_OWNER)}>
                      Agency Owners
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterRole(Role.AGENCY_ADMIN)}>
                      Admins
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterRole(Role.SUBACCOUNT_USER)}>
                      Users
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterRole(Role.SUBACCOUNT_GUEST)}>
                      Guests
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white/60 hover:text-white hover:bg-white/5"
                  onClick={() => toast.success("Exporting team data...")}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>

                {/* Invite Button with Dialog */}
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gradient-to-br from-[#1A1F3A] to-[#0F1425] border-white/10">
                    <DialogHeader>
                      <DialogTitle className="text-white text-xl flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]">
                          <UserPlus className="w-4 h-4 text-white" />
                        </div>
                        Invite Team Member
                      </DialogTitle>
                      <DialogDescription className="text-white/60">
                        Send an invitation to join {agencyDetails.name}
                      </DialogDescription>
                    </DialogHeader>
                    
                    {/* Using the existing SendInvitation component */}
                    <SendInvitation agencyId={agencyId} />
                    
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Results count */}
            <p className="text-xs text-white/40 mb-4">
              Showing {filtered.length} of {teamMembers.length} members
              {query && ` matching "${query}"`}
            </p>

            {/* Team Members Grid */}
            {filtered.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((member, index) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    index={index}
                    getInitials={getInitials}
                    getStatusColor={() => statusColors[index % statusColors.length]}
                    getRoleBadgeColor={getRoleBadgeColor}
                    getRoleLabel={getRoleLabel}
                  />
                ))}
              </div>
            ) : (
              <EmptyState query={query} onClear={() => setQuery("")} />
            )}
          </div>
        </div>
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

// Member Card Component
const MemberCard = ({ 
  member, 
  index, 
  getInitials, 
  getStatusColor, 
  getRoleBadgeColor, 
  getRoleLabel 
}: any) => {
  return (
    <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden group hover:scale-[1.02] transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-12 w-12 ring-2 ring-[#4F46E5]/30">
                <AvatarImage src={member.avatarUrl || ""} />
                <AvatarFallback className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white">
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${getStatusColor} ring-2 ring-[#0F1425]`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold">{member.name}</h3>
                {member.role === Role.AGENCY_OWNER && (
                  <Crown className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-xs text-white/40">{member.email}</p>
            </div>
          </div>
          <Badge className={getRoleBadgeColor(member.role)}>
            {getRoleLabel(member.role)}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-white/5">
            <p className="text-xs text-white/40">Projects</p>
            <p className="text-sm font-medium text-white">12</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/5">
            <p className="text-xs text-white/40">Tasks</p>
            <p className="text-sm font-medium text-white">48</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/5">
            <p className="text-xs text-white/40">Activity</p>
            <p className="text-sm font-medium text-emerald-400">High</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/40 hover:text-white">
              <Mail className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/40 hover:text-white">
              <MessageCircle className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/40 hover:text-white">
              <Calendar className="w-4 h-4" />
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/40 hover:text-white">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1A1F3A] border-white/10 text-white">
              <DropdownMenuItem className="hover:bg-white/5">
                <UserCog className="w-3 h-3 mr-2" /> Manage Role
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-white/5">
                <Key className="w-3 h-3 mr-2" /> Reset Password
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-white/5">
                <Copy className="w-3 h-3 mr-2" /> Copy Email
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem className="text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-3 h-3 mr-2" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};

// Empty State Component
const EmptyState = ({ query, onClear }: { query: string; onClear: () => void }) => (
  <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl">
    <CardContent className="p-12 text-center">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#4F46E5]/20 to-[#7C3AED]/20 flex items-center justify-center">
        <Users className="w-8 h-8 text-white/40" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">
        {query ? `No results for "${query}"` : "No members found"}
      </h3>
      <p className="text-sm text-white/50 mb-4">
        {query ? "Try a different search term" : "Invite your first team member to get started"}
      </p>
      {query && (
        <Button 
          variant="ghost" 
          onClick={onClear}
          className="text-white/60 hover:text-white hover:bg-white/5"
        >
          Clear Search
        </Button>
      )}
    </CardContent>
  </Card>
);