import React from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import {
  CreditCard,
  Receipt,
  Download,
  MoreVertical,
  ChevronRight,
  Crown,
  Activity,
  IndianRupee,
  Percent,
  ArrowUpRight,
  Mail,
  Phone,
  MapPin,
  Building2,
  BarChart3,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  Wallet,
  Zap,
  Shield,
  Star,
  Gem,
  Rocket,
  HelpCircle,
  AlertCircle
} from "lucide-react";

import { getAgencyDetails, getAgencySubscription } from "@/queries/agency";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plan } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";

import SubscriptionFormWrapper from "./_components/SubscriptionFormWrapper";
import { constructMetadata } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface AgencyBillingPageProps {
  params: {
    agencyId: string | undefined;
  };
}

const AgencyBillingPage = async ({
  params,
}: AgencyBillingPageProps) => {
  const { agencyId } = params;
  const authUser = await currentUser();

  if (!authUser) redirect("/agency/sign-in");
  if (!agencyId) redirect("/agency/unauthorized");

  const agencyDetails = await getAgencyDetails(agencyId);
  if (!agencyDetails) redirect("/agency/unauthorized");

  const agencySubscription = await getAgencySubscription(agencyId);

  const isActive = agencySubscription?.subscriptions?.active ?? false;
  const currentPlan = agencySubscription?.subscriptions?.plan;

  // since you don't have payment queries,
  // we fallback to empty array safely
  const payments: any[] = [];

  const totalSpent = 0;
  const thisMonthSpent = 0;
  const successfulPayments = 0;
  const pendingPayments = 0;
  const failedPayments = 0;

  const stats = [
    {
      label: "Total Spent",
      value: `₹0`,
      icon: IndianRupee,
      change: `₹0 this month`,
      trend: "+0%",
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-400"
    },
    {
      label: "Transactions",
      value: payments.length,
      icon: Receipt,
      change: `${successfulPayments} successful`,
      trend: "0 pending",
      color: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-500/10",
      iconColor: "text-emerald-400"
    },
    {
      label: "Success Rate",
      value: `0%`,
      icon: Activity,
      change: `${failedPayments} failed`,
      trend: "0% this month",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-500/10",
      iconColor: "text-purple-400"
    },
    {
      label: "Platform Fee",
      value: "1%",
      icon: Percent,
      change: "Per transaction",
      trend: "Lowest in industry",
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-500/10",
      iconColor: "text-amber-400"
    },
  ];

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
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">Billing</h1>
                  <Badge className="bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-white border-white/10 backdrop-blur-sm px-2 py-0.5 text-xs">
                    <Crown className="w-3 h-3 mr-1 text-amber-300" />
                    {agencyDetails.name}
                  </Badge>
                </div>
                <p className="text-white/70 text-xs flex items-center">
                  Manage your billing, invoices, and payment methods
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
                  <span className="text-xs font-medium text-white">{isActive ? '1' : '0'}</span>
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
              { icon: CreditCard, label: 'Overview', active: true, color: 'from-indigo-500 to-purple-600' },
              { icon: Receipt, label: 'Invoices', active: false, color: 'from-purple-500 to-pink-600' },
              { icon: Wallet, label: 'Payments', active: false, color: 'from-pink-500 to-rose-600' },
              { icon: Shield, label: 'Plans', active: false, color: 'from-amber-500 to-orange-600' },
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
              <div className={`px-2 py-1 rounded-lg bg-gradient-to-r ${
                isActive 
                  ? 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20' 
                  : 'from-amber-500/10 to-orange-500/10 border-amber-500/20'
              } backdrop-blur-sm`}>
                <div className="flex items-center gap-1">
                  <Activity className={`w-3 h-3 ${isActive ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span className={`text-[10px] font-medium ${isActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
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
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, idx) => (
            <Card key={idx} className="border-0 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all duration-300 group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/50">{stat.label}</p>
                    <p className="text-xl font-bold text-white mt-1">{stat.value}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-emerald-400 flex items-center">
                        <ArrowUpRight className="w-3 h-3 mr-0.5" />
                        {stat.change}
                      </p>
                      <span className="text-xs text-white/30">•</span>
                      <p className="text-xs text-white/30">{stat.trend}</p>
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg ${stat.bgColor} group-hover:scale-110 transition-transform`}>
                    <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Agency Info */}
            <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5]/0 via-[#7C3AED]/0 to-[#DB2777]/0 group-hover:from-[#4F46E5]/5 group-hover:via-[#7C3AED]/5 group-hover:to-[#DB2777]/5 transition-all duration-500" />
              
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-full blur-md opacity-50" />
                    <Avatar className="h-12 w-12 ring-2 ring-[#4F46E5]/30 relative">
                      <AvatarImage src={agencyDetails.agencyLogo ?? ""} />
                      <AvatarFallback className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white">
                        {agencyDetails.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{agencyDetails.name}</p>
                    <p className="text-[10px] text-white/40">ID: {agencyId.slice(0, 8)}...</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-white/60 mb-4">
                  {agencyDetails.companyEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3 text-[#4F46E5]" />
                      <span className="truncate">{agencyDetails.companyEmail}</span>
                    </div>
                  )}
                  {agencyDetails.companyPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-[#7C3AED]" />
                      <span>{agencyDetails.companyPhone}</span>
                    </div>
                  )}
                  {agencyDetails.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-[#DB2777]" />
                      <span className="truncate">{agencyDetails.address}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/40">Plan</p>
                    <p className="text-xs font-semibold text-white mt-1">
                      {
  currentPlan === Plan.price_1OpACCFdfEv15JJwACWCyqW2
    ? "Base Plan"
    : currentPlan === Plan.price_1OpACCFdfEv15JJw0k6lm8HC
    ? "Unlimited Plan"
    : "No Plan"
}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/40">Status</p>
                    <p className={`text-xs font-semibold mt-1 ${isActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Billing Summary */}
            <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#4F46E5]" />
                  Billing Summary
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/40">Monthly Budget</span>
                      <span className="text-white">₹0 / ₹50,000</span>
                    </div>
                    <Progress value={0} className="h-1 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-[#4F46E5] [&>div]:to-[#7C3AED]" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/40">Next Invoice</span>
                      <span className="text-white/60">No upcoming</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Total Spent</span>
                      <span className="text-white font-semibold">₹0</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Quick Tips
                </h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-xs">
                    <Zap className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-white/60">Platform fee is only 1% per transaction</p>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Shield className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <p className="text-white/60">Payouts are processed monthly</p>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <HelpCircle className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-white/60">Contact support for billing issues</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Current Plan */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-r from-[#4F46E5]/20 to-[#7C3AED]/20">
                  <Crown className="w-4 h-4 text-[#4F46E5]" />
                </div>
                Current Plan
              </h2>

              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#DB2777]" />
                <CardContent className="p-6">
                  <SubscriptionFormWrapper
                    customerId={agencySubscription?.customerId ?? ""}
                    isPlanExists={isActive}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Payment History */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                  </div>
                  Payment History
                </h2>

                <Tabs defaultValue="all" className="w-auto">
                  <TabsList className="bg-[#1A1F3A]/90 border border-white/10">
                    <TabsTrigger value="all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#4F46E5] data-[state=active]:to-[#7C3AED] data-[state=active]:text-white">
                      All
                    </TabsTrigger>
                    <TabsTrigger value="paid" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white">
                      Paid
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white">
                      Pending
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                <CardContent className="p-0">
                  {payments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-white/5">
                          <TableHead className="text-white/50">Description</TableHead>
                          <TableHead className="text-white/50">Date</TableHead>
                          <TableHead className="text-white/50">Status</TableHead>
                          <TableHead className="text-white/50">Amount</TableHead>
                          <TableHead className="text-white/50"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment: any) => (
                          <TableRow key={payment.id} className="border-white/10 hover:bg-white/5">
                            <TableCell className="text-white">{payment.description}</TableCell>
                            <TableCell className="text-white/70">
                              {format(new Date(payment.createdAt), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  payment.status === "paid"
                                    ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border-0"
                                    : payment.status === "pending"
                                    ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border-0"
                                    : "bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border-0"
                                }
                              >
                                {payment.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-white font-medium">
                              ₹{(payment.amount / 100).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/40 hover:text-white">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-[#1A1F3A] border-white/10 text-white">
                                  <DropdownMenuItem className="hover:bg-white/5">
                                    <Receipt className="w-3 h-3 mr-2" /> View Invoice
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="hover:bg-white/5">
                                    <Download className="w-3 h-3 mr-2" /> Download Receipt
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-[#4F46E5]/20 to-[#7C3AED]/20 flex items-center justify-center">
                        <Receipt className="w-6 h-6 text-white/40" />
                      </div>
                      <p className="text-white font-medium mb-1">No transactions yet</p>
                      <p className="text-sm text-white/30 max-w-md">
                        Funnel payments will appear here after customers complete purchases. Start by creating a funnel and accepting payments.
                      </p>
                      <Button className="mt-4 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white">
                        <Zap className="w-4 h-4 mr-2" />
                        Create Funnel
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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
};

export default AgencyBillingPage;

export const metadata = constructMetadata({
  title: "Billing - Aexon",
});