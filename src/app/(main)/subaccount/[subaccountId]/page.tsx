import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Clipboard,
  Contact2,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
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
  Eye,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Filter,
  LayoutDashboard,
  Settings,
  Percent,
  Award,
  Gem,
  Gauge,
  LineChart,
  PieChart as PieChartIcon
} from "lucide-react";

import { getSubAccountDetails } from "@/queries/subaccount";
import { getFunnels } from "@/queries/funnels";

import { AreaChart } from "@/components/ui/area-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { CircleProgress } from "@/components/ui/circle-progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgeDelta } from "@/components/ui/badge-delta";
import PipelineValue from "@/components/modules/pipelines/PipelineValue";
import FunnelSubAccountChart from "@/components/modules/funnels/FunnelSubAccountChart";
import BlurPage from "@/components/common/BlurPage";

import { constructMetadata } from "@/lib/utils";

interface SubAccountPageIdProps {
  params: {
    subaccountId: string | undefined;
  };
}

const SubAccountPageId: React.FC<SubAccountPageIdProps> = async ({
  params,
}) => {
  const { subaccountId } = params;

  if (!subaccountId) redirect("/subaccount/unauthorized");

  let currency: string = "INR";
  let totalClosedSessions: any[] = [];
  let totalPendingSessions;
  let net: number = 0;
  let potentialIncome: number = 0;
  let closingRate: number = 0;
  let sessions: any[] = [];

  const subAccountDetails = await getSubAccountDetails(subaccountId);

  if (!subAccountDetails) redirect("/subaccount/unauthorized");

  // TODO: Implement Razorpay order fetching

  const funnels = await getFunnels(subaccountId);

  const funnelPerformanceMetrics = funnels.map((funnel) => ({
    ...funnel,
    totalFunnelVisits: funnel.funnelPages.reduce(
      (total, page) => total + page.visits,
      0
    ),
  }));

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const monthlyGrowth = 12.5;
  const activeFunnels = funnels.length;
  const totalVisits = funnelPerformanceMetrics.reduce(
    (total, funnel) => total + funnel.totalFunnelVisits,
    0
  );

  return (
    <BlurPage>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0F1E] via-[#0F1425] to-[#0A0F1E]">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#4F46E5]/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#7C3AED]/20 rounded-full blur-3xl animate-pulse animation-delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#DB2777]/10 rounded-full blur-3xl animate-pulse animation-delay-2000" />
        </div>

        {/* Premium Header - COMPACT VERSION */}
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
                    <LayoutDashboard className="w-5 h-5 text-white" />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <Badge className="bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-white border-white/10 backdrop-blur-sm px-2 py-0.5 text-xs">
                      <Crown className="w-3 h-3 mr-1 text-amber-300" />
                      {subAccountDetails.name}
                    </Badge>
                  </div>
                  <p className="text-white/70 text-xs flex items-center">
                    Monitor your subaccount performance and analytics
                    <ChevronRight className="w-3 h-3 ml-1 text-white/40" />
                  </p>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
                    <span className="text-xs text-white/80">Live</span>
                  </div>
                  <Separator orientation="vertical" className="h-4 bg-white/20" />
                  <div className="flex items-center space-x-1">
                    <Activity className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-xs font-medium text-white">{activeFunnels}</span>
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
                { icon: Filter, label: 'Funnels', active: false, color: 'from-purple-500 to-pink-600' },
                { icon: Settings, label: 'Settings', active: false, color: 'from-pink-500 to-rose-600' },
                { icon: Users, label: 'Team', active: false, color: 'from-amber-500 to-orange-600' },
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
                    <Eye className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-medium text-emerald-400">{totalVisits} VIEWS</span>
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
          {/* Quick Stats - Compact Row */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/50">Monthly Growth</p>
                  <p className="text-base font-bold text-white mt-0.5">+{monthlyGrowth}%</p>
                </div>
                <div className="p-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/50">Active Funnels</p>
                  <p className="text-base font-bold text-white mt-0.5">{activeFunnels}</p>
                </div>
                <div className="p-1.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20">
                  <Filter className="w-3.5 h-3.5 text-blue-400" />
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/50">Total Visits</p>
                  <p className="text-base font-bold text-white mt-0.5">{totalVisits.toLocaleString()}</p>
                </div>
                <div className="p-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                  <Eye className="w-3.5 h-3.5 text-purple-400" />
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/50">Conversion Rate</p>
                  <p className="text-base font-bold text-white mt-0.5">{closingRate}%</p>
                </div>
                <div className="p-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20">
                  <Percent className="w-3.5 h-3.5 text-amber-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Main Stats Cards - Redesigned Layout */}
          <div className="flex flex-col gap-4 pb-6">
            {/* Income Cards Row - More Compact */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Total Income Card */}
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-white/50 flex items-center gap-1">
                        <Wallet className="w-3 h-3" />
                        Total Income
                      </p>
                      <p className="text-xl font-bold text-white mt-1">
                        ₹{net ? net.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-emerald-400 flex items-center">
                          <ArrowUpRight className="w-2.5 h-2.5" />
                          +{monthlyGrowth}%
                        </span>
                        <span className="text-[10px] text-white/30">vs last month</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20">
                      <IndianRupee className="w-4 h-4 text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Potential Income Card */}
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-white/50 flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Potential Income
                      </p>
                      <p className="text-xl font-bold text-white mt-1">
                        ₹{potentialIncome ? potentialIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-blue-400 flex items-center">
                          <ArrowUpRight className="w-2.5 h-2.5" />
                          +8.3%
                        </span>
                        <span className="text-[10px] text-white/30">projected</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20">
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pipeline Value Card - Custom Styled */}
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden col-span-1 md:col-span-2 xl:col-span-1">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-white/50 flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        Pipeline Value
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div>
                          <p className="text-xs text-white/30">Closed</p>
                          <p className="text-sm font-semibold text-emerald-400">₹0</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white/30">Total</p>
                          <p className="text-sm font-semibold text-white">₹0</p>
                        </div>
                      </div>
                      <Progress value={0} className="h-1 mt-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-500" />
                      <p className="text-[10px] text-white/30 mt-2 leading-tight">
                        Total value of all tickets except last lane
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lead Cycle Card */}
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-white/50 flex items-center gap-1">
                        <PieChartIcon className="w-3 h-3" />
                        Lead Cycle
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div>
                          <p className="text-xs text-white/30">Conversion</p>
                          <p className="text-sm font-semibold text-emerald-400">{closingRate}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white/30">Closing Rate</p>
                          <p className="text-sm font-semibold text-white">{closingRate}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1">
                          <ShoppingCart className="w-3 h-3 text-emerald-400" />
                          <span className="text-xs text-white">{totalClosedSessions?.length || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-400" />
                          <span className="text-xs text-white">0</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* Funnel Performance Card */}
              <Card className="xl:col-span-2 border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-r from-[#4F46E5]/20 to-[#7C3AED]/20">
                      <BarChart3 className="w-4 h-4 text-[#4F46E5]" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-sm">Funnel Performance</CardTitle>
                      <CardDescription className="text-white/30 text-[10px]">
                        Page visits across all funnels
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <FunnelSubAccountChart data={funnelPerformanceMetrics} />
                  <p className="text-[10px] text-white/30 mt-2">
                    Total page visits across all funnels. Hover to get more details on funnel page performance.
                  </p>
                </CardContent>
              </Card>

              {/* Checkout Activity Card */}
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20">
                      <Activity className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-sm">Checkout Activity</CardTitle>
                      <CardDescription className="text-white/30 text-[10px]">
                        Revenue over time
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <AreaChart
                    className="text-white stroke-[#4F46E5] h-[120px]"
                    data={sessions || []}
                    index="created"
                    categories={["amount_total"]}
                    colors={["#4F46E5"]}
                    yAxisWidth={30}
                    showAnimation={true}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Transaction History Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                    <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  Transaction History
                </h2>
                <BadgeDelta
                  className="rounded-lg bg-transparent text-[10px]"
                  deltaType="moderateIncrease"
                  isIncreasePositive={true}
                  size="xs"
                >
                  +12.3%
                </BadgeDelta>
              </div>

              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-white/5">
                        <TableHead className="text-white/30 text-[10px] w-[300px]">Email</TableHead>
                        <TableHead className="text-white/30 text-[10px] w-[200px]">Status</TableHead>
                        <TableHead className="text-white/30 text-[10px]">Created Date</TableHead>
                        <TableHead className="text-white/30 text-[10px] text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {totalClosedSessions && totalClosedSessions.length > 0 ? (
                        totalClosedSessions.map((session: any) => (
                          <TableRow key={session.id} className="border-white/10 hover:bg-white/5">
                            <TableCell className="text-white text-xs">
                              {session.customer_details?.email || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border-0 text-[10px] px-1.5 py-0">
                                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                                Paid
                              </Badge>
                            </TableCell>
                            <TableCell className="text-white/50 text-[10px]">
                              {format(new Date(session.created), "dd/MM/yyyy hh:mm")}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-white/20 text-[8px]">INR</span>{" "}
                              <span className="text-emerald-400 text-xs font-medium">
                                {session.amount_total}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-white/30 text-xs">
                            No transactions found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

    
    </BlurPage>
  );
};

export default SubAccountPageId;

export const metadata = constructMetadata({
  title: "Dashboard - Aexon",
});