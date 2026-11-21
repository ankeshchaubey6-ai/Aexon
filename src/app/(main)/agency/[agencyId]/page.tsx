import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { billingService } from "@/lib/services/billing.service";
import {
  Clipboard,
  Contact2,
  DollarSign,
  Goal,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Users,
  Target,
  Activity,
  Sparkles,
  Crown,
  Zap,
  BarChart3,
  PieChart,
  CreditCard,
  IndianRupee,
  Download,
  MoreHorizontal,
  ChevronRight,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

import { getAgencyDashboardDetails } from "@/queries/agency";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { CircleProgress } from "@/components/ui/circle-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { constructMetadata } from "@/lib/utils";
import DemoDataButton from "@/components/modules/demo-data/DemoDataButton";

export const maxDuration = 60;

interface AgencyIdPageProps {
  params: {
    agencyId: string | undefined;
  };
}

const AgencyIdPage: React.FC<AgencyIdPageProps> = async ({ params }) => {
  const { agencyId } = params;

  if (!agencyId) redirect("/agency/unauthorized");

  let net: number = 0;
  let potentialIncome: number = 0;
  let closingRate: number = 0;

  const agencyDetails = await getAgencyDashboardDetails(agencyId);

  if (!agencyDetails) redirect("/agency/unauthorized");

  const subAccountCount = agencyDetails._count.subAccounts;

  // Mock data for premium feel
  const recentTransactions = [
    { id: 1, date: "2024-03-15", amount: 15000, status: "completed", customer: "Tech Corp", type: "subscription" },
    { id: 2, date: "2024-03-14", amount: 25000, status: "completed", customer: "Design Studio", type: "one-time" },
    { id: 3, date: "2024-03-13", amount: 5000, status: "pending", customer: "Startup Inc", type: "subscription" },
    { id: 4, date: "2024-03-12", amount: 10000, status: "completed", customer: "Agency Plus", type: "one-time" },
  ];

  const monthlyGrowth = 12.5;
  const yearlyGrowth = 28.3;

  return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0F1E] via-[#0F1425] to-[#0A0F1E]">
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
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <Badge className="bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-white border-white/10 backdrop-blur-sm px-2 py-0.5 text-xs">
                      <Crown className="w-3 h-3 mr-1 text-amber-300" />
                      Enterprise
                    </Badge>
                  </div>
                  <p className="text-white/70 text-xs flex items-center">
                    Welcome back, {agencyDetails.name}
                    <ChevronRight className="w-3 h-3 ml-1 text-white/40" />
                  </p>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="flex items-center space-x-4">
                <DemoDataButton />
                <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
                    <span className="text-xs text-white/80">Live</span>
                  </div>
                  <Separator orientation="vertical" className="h-4 bg-white/20" />
                  <div className="flex items-center space-x-1">
                    <Activity className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-xs font-medium text-white">{subAccountCount}</span>
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
                { icon: BarChart3, label: 'Overview', active: true, color: 'from-indigo-500 to-purple-600' },
                { icon: Building2, label: 'Agency', active: false, color: 'from-purple-500 to-pink-600' },
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
                    <Crown className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] font-medium text-amber-400">PRO</span>
                  </div>
                </div>
                <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 backdrop-blur-sm">
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-medium text-emerald-400">{subAccountCount} ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subtle Gradient Line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
        </div>

        {/* Quick Stats Cards - Moved below header but keep compact */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50">Monthly Growth</p>
                  <p className="text-xl font-bold text-white mt-1">+{monthlyGrowth}%</p>
                </div>
                <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50">Yearly Growth</p>
                  <p className="text-xl font-bold text-white mt-1">+{yearlyGrowth}%</p>
                </div>
                <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50">Avg. Deal Size</p>
                  <p className="text-xl font-bold text-white mt-1">₹12.5k</p>
                </div>
                <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                  <Wallet className="w-4 h-4 text-purple-400" />
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50">Active Projects</p>
                  <p className="text-xl font-bold text-white mt-1">{subAccountCount * 3}</p>
                </div>
                <div className="p-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20">
                  <Target className="w-4 h-4 text-amber-400" />
                </div>
              </div>
            </div>
          </div>

          {billingService.shouldBlockDashboard(agencyDetails) && (
            <div className="absolute inset-0 z-30 flex items-center justify-center backdrop-blur-md bg-[#0A0F1E]/80">
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A] to-[#0F1425] shadow-2xl max-w-md">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                    <CardTitle className="text-white">Connect Your Payment Gateway</CardTitle>
                  </div>
                  <CardDescription className="text-white/60">
                    You need to connect your payment gateway to see metrics and start accepting payments.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href={`/agency/${agencyDetails.id}/launchpad`}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    <Clipboard className="w-4 h-4 mr-2" />
                    Go to Launch Pad
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Stats Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-8">
            {/* Income Card */}
            <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden group hover:scale-[1.02] transition-all duration-300">
              <CardHeader className="pb-2">
                <CardDescription className="text-white/50 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Total Income
                </CardDescription>
                <CardTitle className="text-3xl font-bold text-white">
                  ₹{net ? net.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-400 flex items-center">
                    <ArrowUpRight className="w-3 h-3" />
                    +12.5%
                  </span>
                  <span className="text-white/40">vs last month</span>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  For the year {format(new Date(), "yyyy")}
                </p>
              </CardContent>
              <div className="absolute top-4 right-4 p-2 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20">
                <IndianRupee className="w-5 h-5 text-emerald-400" />
              </div>
            </Card>

            {/* Potential Income Card */}
            <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden group hover:scale-[1.02] transition-all duration-300">
              <CardHeader className="pb-2">
                <CardDescription className="text-white/50 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Potential Income
                </CardDescription>
                <CardTitle className="text-3xl font-bold text-white">
                  ₹{potentialIncome ? potentialIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-blue-400 flex items-center">
                    <ArrowUpRight className="w-3 h-3" />
                    +8.3%
                  </span>
                  <span className="text-white/40">projected</span>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  Based on current pipeline
                </p>
              </CardContent>
              <div className="absolute top-4 right-4 p-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
            </Card>

            {/* Active Clients Card */}
            <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden group hover:scale-[1.02] transition-all duration-300">
              <CardHeader className="pb-2">
                <CardDescription className="text-white/50 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Active Clients
                </CardDescription>
                <CardTitle className="text-3xl font-bold text-white">
                  {subAccountCount}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-purple-400 flex items-center">
                    <ArrowUpRight className="w-3 h-3" />
                    +2
                  </span>
                  <span className="text-white/40">this month</span>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  Active sub accounts
                </p>
              </CardContent>
              <div className="absolute top-4 right-4 p-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                <Contact2 className="w-5 h-5 text-purple-400" />
              </div>
            </Card>

            {/* Agency Goal Card */}
            <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden group hover:scale-[1.02] transition-all duration-300">
              <CardHeader className="pb-2">
                <CardDescription className="text-white/50 flex items-center gap-2">
                  <Goal className="w-4 h-4" />
                  Agency Goal
                </CardDescription>
                <CardTitle className="text-3xl font-bold text-white">
                  {agencyDetails.goal}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/50">Progress</span>
                    <span className="text-white">{Math.round((subAccountCount / agencyDetails.goal) * 100)}%</span>
                  </div>
                  <Progress 
                    value={(subAccountCount / agencyDetails.goal) * 100}
                    className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-[#4F46E5] [&>div]:to-[#7C3AED]"
                  />
                  <p className="text-xs text-white/40 mt-2">
                    {subAccountCount} of {agencyDetails.goal} sub accounts
                  </p>
                </div>
              </CardContent>
              <div className="absolute top-4 right-4 p-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20">
                <Target className="w-5 h-5 text-amber-400" />
              </div>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
            {/* Transaction History Chart */}
            <Card className="lg:col-span-2 border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-r from-[#4F46E5]/20 to-[#7C3AED]/20">
                      <BarChart3 className="w-5 h-5 text-[#4F46E5]" />
                    </div>
                    <div>
                      <CardTitle className="text-white">Transaction History</CardTitle>
                      <CardDescription className="text-white/40">
                        Monthly revenue overview
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/5">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-[#1A1F3A] border-white/10 text-white">
                      <DropdownMenuItem>Last 7 days</DropdownMenuItem>
                      <DropdownMenuItem>Last 30 days</DropdownMenuItem>
                      <DropdownMenuItem>Last 3 months</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex min-h-[220px] items-center justify-center text-sm text-white/50">
                  No transaction data available yet.
                </div>
              </CardContent>
            </Card>

            {/* Conversions Card */}
            <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20">
                    <PieChart className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Conversion Rate</CardTitle>
                    <CardDescription className="text-white/40">
                      Overall performance
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <CircleProgress
                  value={closingRate}
                  description={
                    <div className="text-center space-y-3">
                      <div className="flex items-center justify-center gap-4">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4 text-emerald-400" />
                          <span className="text-white text-sm">
                            0 Won
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-rose-400" />
                          <span className="text-white text-sm">0 Lost</span>
                        </div>
                      </div>
                      <div className="pt-2">
                        <div className="text-2xl font-bold text-white">{closingRate}%</div>
                        <p className="text-xs text-white/40">Closing Rate</p>
                      </div>
                    </div>
                  }
                />
              </CardContent>
            </Card>
          </div>

          {/* Recent Transactions Table */}
          <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                    <CreditCard className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Recent Transactions</CardTitle>
                    <CardDescription className="text-white/40">
                      Latest payment activities
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/5">
                  View All
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableHead className="text-white/50">Date</TableHead>
                    <TableHead className="text-white/50">Customer</TableHead>
                    <TableHead className="text-white/50">Type</TableHead>
                    <TableHead className="text-white/50">Amount</TableHead>
                    <TableHead className="text-white/50">Status</TableHead>
                    <TableHead className="text-white/50"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((tx) => (
                    <TableRow key={tx.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white">{format(new Date(tx.date), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-white">{tx.customer}</TableCell>
                      <TableCell>
                        <Badge className={tx.type === 'subscription' 
                          ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border-0'
                          : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 border-0'
                        }>
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white font-medium">₹{tx.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={tx.status === 'completed'
                          ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border-0'
                          : 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border-0'
                        }>
                          {tx.status === 'completed' ? (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : (
                            <Clock className="w-3 h-3 mr-1" />
                          )}
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-white/40 hover:text-white">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

      {/* Animations */}
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
};

export default AgencyIdPage;

export const metadata = constructMetadata({
  title: "Dashboard - Aexon",
});