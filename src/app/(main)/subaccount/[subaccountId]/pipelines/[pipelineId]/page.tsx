import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft,
  Crown,
  Activity,
  Clock,
  ChevronRight,
  Zap,
  Award,
  LayoutDashboard,
  Settings,
  BarChart3,
  Users,
  GitBranch,
  TrendingUp,
  Target,
  CheckCircle2,
  Layers,
  Eye,
  Sparkles,
} from "lucide-react";

import { getPipelineWorkspace } from "@/queries/pipelines";
import { updateLanesOrder, updateTicketsOrder } from "@/queries/lanes";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import BlurPage from "@/components/common/BlurPage";
import PipelineInfoBar from "@/components/modules/pipelines/PipelineInfoBar";
import PipelineSettings from "@/components/forms/PipelineSettings";
import PipelineView from "@/components/modules/pipelines/PipelineView";
import { constructMetadata } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PipelineIdPageProps {
  params: {
    subaccountId: string | undefined;
    pipelineId: string | undefined;
  };
}

const PipelineIdPage: React.FC<PipelineIdPageProps> = async ({ params }) => {
  const { subaccountId, pipelineId } = params;

  if (!subaccountId) redirect(`/subaccount/unauthorized`);
  if (!pipelineId) redirect(`/subaccount/${subaccountId}/pipelines`);

  const { pipelineDetails, allPipelines, lanes, subaccount } =
    await getPipelineWorkspace(subaccountId, pipelineId);

  if (!pipelineDetails) {
    redirect(`/subaccount/${subaccountId}/pipelines`);
  }

  // Calculate stats
  const totalLanes = lanes.length;
  const totalTickets = lanes.reduce((acc, lane) => acc + (lane.tickets?.length || 0), 0);
  const totalValue = lanes.reduce((acc, lane) => 
    acc + (lane.tickets?.reduce((sum, ticket) => sum + (Number(ticket.value) || 0), 0) || 0), 0
  );
  const completedTickets = lanes.reduce((acc, lane) => {
  const isCompletedLane =
    lane.name.toLowerCase().includes("complete") ||
    lane.name.toLowerCase().includes("won") ||
    lane.name.toLowerCase().includes("done");

  if (isCompletedLane) {
    return acc + (lane.tickets?.length || 0);
  }

  return acc;
}, 0);

  return (
    <BlurPage>
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

        {/* Premium Header - COMPACT SIZE */}
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
                <Link
                  href={`/subaccount/${subaccountId}/pipelines`}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity" />
                  <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl hover:scale-105 transition-transform">
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </div>
                </Link>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-white">{pipelineDetails.name}</h1>
                    <Badge className="bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-white border-white/10 backdrop-blur-sm px-2 py-0.5 text-xs">
                      <Crown className="w-3 h-3 mr-1 text-amber-300" />
                      {subaccount?.name || "Subaccount"}
                    </Badge>
                  </div>
                  <p className="text-white/70 text-xs flex items-center">
                    Manage your pipeline stages and track deals
                    <ChevronRight className="w-3 h-3 ml-1 text-white/40" />
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
                    <span className="text-xs text-white/80">Active</span>
                  </div>
                  <Separator orientation="vertical" className="h-4 bg-white/20" />
                  <div className="flex items-center space-x-1">
                    <GitBranch className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-xs font-medium text-white">{allPipelines.length}</span>
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
                { icon: LayoutDashboard, label: "Dashboard", href: `/subaccount/${subaccountId}`, active: false },
                { icon: GitBranch, label: "Pipelines", href: `/subaccount/${subaccountId}/pipelines`, active: true },
                { icon: Settings, label: "Settings", href: `/subaccount/${subaccountId}/settings`, active: false },
                { icon: BarChart3, label: "Analytics", href: `/subaccount/${subaccountId}/analytics`, active: false },
              ].map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className={`group relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 overflow-hidden ${
                    item.active
                      ? "text-white shadow-lg"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {item.active && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-600 opacity-100" />
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
                </Link>
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
                    <span className="text-[10px] font-medium text-emerald-400">{totalLanes} LANES</span>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard 
              title="Total Lanes" 
              value={totalLanes} 
              icon={Layers}
              color="from-blue-500/20 to-cyan-500/20"
              iconColor="text-blue-400"
              trend={`${totalLanes} pipeline stages`}
            />
            <StatCard 
              title="Total Tickets" 
              value={totalTickets} 
              icon={Target}
              color="from-emerald-500/20 to-teal-500/20"
              iconColor="text-emerald-400"
              trend={`${completedTickets} completed`}
            />
            <StatCard 
              title="Pipeline Value" 
              value={`₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} 
              icon={TrendingUp}
              color="from-purple-500/20 to-pink-500/20"
              iconColor="text-purple-400"
              trend="Total deal value"
            />
            <StatCard 
              title="Completion Rate" 
              value={totalTickets > 0 ? `${Math.round((completedTickets / totalTickets) * 100)}%` : "0%"} 
              icon={CheckCircle2}
              color="from-amber-500/20 to-orange-500/20"
              iconColor="text-amber-400"
              trend="Tickets completed"
            />
          </div>

          {/* Tabs Section */}
          <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
            <CardContent className="p-0">
              <Tabs defaultValue="view" className="w-full">
                <div className="border-b border-white/10 px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <PipelineInfoBar
                        pipelineId={pipelineId}
                        subAccountId={subaccountId}
                        pipelines={allPipelines}
                      />
                    </div>
                    
                    <TabsList className="bg-transparent h-auto py-4 gap-6">
                      <TabsTrigger 
                        value="view" 
                        className="data-[state=active]:bg-transparent data-[state=active]:text-[#4F46E5] data-[state=active]:shadow-none rounded-none px-1 pb-3 relative text-white/60 hover:text-white transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          <span>Pipeline View</span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] opacity-0 data-[state=active]:opacity-100 transition-opacity" />
                      </TabsTrigger>
                      <TabsTrigger 
                        value="settings" 
                        className="data-[state=active]:bg-transparent data-[state=active]:text-[#4F46E5] data-[state=active]:shadow-none rounded-none px-1 pb-3 relative text-white/60 hover:text-white transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          <span>Settings</span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] opacity-0 data-[state=active]:opacity-100 transition-opacity" />
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                <TabsContent value="view" className="p-6">
                  <PipelineView
                    lanes={lanes}
                    pipelineDetails={pipelineDetails}
                    pipelineId={pipelineId}
                    subAccountId={subaccountId}
                    updateLanesOrder={updateLanesOrder}
                    updateTicketsOrder={updateTicketsOrder}
                  />
                </TabsContent>

                <TabsContent value="settings" className="p-6">
                  <PipelineSettings
                    pipelineId={pipelineId}
                    pipelines={allPipelines}
                    subaccountId={subaccountId}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Quick Tips Section */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <TipCard
              icon={Target}
              title="Track Deals"
              description="Move tickets across lanes to track progress"
              color="from-blue-500/20 to-cyan-500/20"
              iconColor="text-blue-400"
            />
            <TipCard
              icon={TrendingUp}
              title="Monitor Value"
              description="Keep track of your pipeline's total value"
              color="from-emerald-500/20 to-teal-500/20"
              iconColor="text-emerald-400"
            />
            <TipCard
              icon={Sparkles}
              title="Customize Lanes"
              description="Add or remove lanes to match your sales process"
              color="from-purple-500/20 to-pink-500/20"
              iconColor="text-purple-400"
            />
          </div>
        </div>
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
    </BlurPage>
  );
};

export default PipelineIdPage;

export const metadata = constructMetadata({
  title: "Pipeline - Aexon",
});

const StatCard = ({ title, value, icon: Icon, color, iconColor, trend }: any) => (
  <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all duration-300 group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-white/50">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {trend && (
          <p className="text-xs text-emerald-400 mt-1 flex items-center">
            <TrendingUp className="w-3 h-3 mr-1" />
            {trend}
          </p>
        )}
      </div>
      <div className={`p-2 rounded-lg bg-gradient-to-r ${color} group-hover:scale-110 transition-transform`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
    </div>
  </div>
);

const TipCard = ({ icon: Icon, title, description, color, iconColor }: any) => (
  <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all duration-300">
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg bg-gradient-to-r ${color}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div>
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <p className="text-xs text-white/40 mt-1">{description}</p>
      </div>
    </div>
  </div>
);
