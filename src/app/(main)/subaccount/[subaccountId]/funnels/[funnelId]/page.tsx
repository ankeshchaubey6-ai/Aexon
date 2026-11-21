import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { 
  ArrowLeft, 
  Funnel, 
  Settings, 
  Layers, 
  Sparkles,
  Crown,
  Activity,
  Clock,
  ChevronRight,
  Eye,
  Globe,
  Zap,
  Award,
  LayoutDashboard,
  BarChart3,
  Users,
  Rocket,
  Target,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { getFunnel } from "@/queries/funnels";
import { getSubAccountDetails } from "@/queries/subaccount";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import BlurPage from "@/components/common/BlurPage";
import FunnelSettings from "@/components/modules/funnels/FunnelSettings";
import FunnelSteps from "@/components/modules/funnels/FunnelSteps";

import { cn, constructMetadata } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { FunnelsForSubAccount } from "@/lib/types";
import type { FunnelPage } from "@prisma/client";

interface FunnelIdPageProps {
  params: {
    funnelId: string | undefined;
    subaccountId: string | undefined;
  };
}

const FunnelIdPage: React.FC<FunnelIdPageProps> = async ({ params }) => {
  const { funnelId, subaccountId } = params;

  if (!subaccountId) redirect("/subaccount/unauthorized");
  if (!funnelId) redirect(`/subaccount/${subaccountId}/funnels`);

  const [funnelPages, subaccount] = await Promise.all([
    getFunnel(funnelId),
    getSubAccountDetails(subaccountId)
  ]);

  if (!funnelPages) redirect(`/subaccount/${subaccountId}/funnels`);

  const totalPages = funnelPages.funnelPages?.length || 0;
  const totalVisits = funnelPages.funnelPages?.reduce((sum, page) => sum + (page.visits || 0), 0) || 0;
  const isPublished = funnelPages.published;

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

        {/* Premium Header */}
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
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Link
                  href={`/subaccount/${subaccountId}/funnels`}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity" />
                  <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl hover:scale-105 transition-transform">
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </div>
                </Link>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-white">{funnelPages.name}</h1>
                    <Badge className={cn(
                      "px-2 py-0.5 text-xs",
                      isPublished 
                        ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30" 
                        : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30"
                    )}>
                      {isPublished ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Live
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          Draft
                        </>
                      )}
                    </Badge>
                    {funnelPages.subDomainName && (
                      <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 border-white/10 backdrop-blur-sm px-2 py-0.5 text-xs">
                        <Globe className="w-3 h-3 mr-1" />
                        {funnelPages.subDomainName}
                      </Badge>
                    )}
                  </div>
                  <p className="text-white/70 text-xs flex items-center">
                    Manage your funnel steps and settings
                    <ChevronRight className="w-3 h-3 ml-1 text-white/40" />
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
                  <div className="flex items-center space-x-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full animate-pulse shadow-lg",
                      isPublished 
                        ? "bg-emerald-400 shadow-emerald-500/50" 
                        : "bg-amber-400 shadow-amber-500/50"
                    )} />
                    <span className="text-xs text-white/80">
                      {isPublished ? "Live" : "Draft"}
                    </span>
                  </div>
                  <Separator orientation="vertical" className="h-4 bg-white/20" />
                  <div className="flex items-center space-x-1">
                    <Eye className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-xs font-medium text-white">{totalVisits}</span>
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
                    <span className="text-[10px] font-medium text-emerald-400">{totalPages} PAGES</span>
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
              title="Total Pages" 
              value={totalPages} 
              icon={Layers}
              color="from-blue-500/20 to-cyan-500/20"
              iconColor="text-blue-400"
            />
            <StatCard 
              title="Total Visits" 
              value={totalVisits} 
              icon={Eye}
              color="from-emerald-500/20 to-teal-500/20"
              iconColor="text-emerald-400"
              subtext="All time views"
            />
            <StatCard 
              title="Conversion Rate" 
              value={totalVisits > 0 ? `${Math.round((totalPages / totalVisits) * 100)}%` : "0%"} 
              icon={TrendingUp}
              color="from-purple-500/20 to-pink-500/20"
              iconColor="text-purple-400"
              subtext="Page views to pages"
            />
          </div>

          {/* Tabs Section */}
          <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
            <CardContent className="p-0">
              <Tabs defaultValue="steps" className="w-full">
                <div className="border-b border-white/10 px-6">
                  <TabsList className="bg-transparent h-auto py-4 gap-6">
                    <TabsTrigger 
                      value="steps" 
                      className="data-[state=active]:bg-transparent data-[state=active]:text-[#4F46E5] data-[state=active]:shadow-none rounded-none px-1 pb-3 relative text-white/60 hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        <span>Steps</span>
                      </div>
                      {totalPages > 0 && (
                        <Badge className="ml-2 bg-white/10 text-white border-0 text-[10px] px-1.5">
                          {totalPages}
                        </Badge>
                      )}
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

                <TabsContent value="steps" className="p-6">
                  <FunnelSteps
                    funnel={funnelPages}
                    subAccountId={subaccountId}
                    initialPages={funnelPages.funnelPages as FunnelPage[]}
                    funnelId={funnelId}
                  />
                </TabsContent>

                <TabsContent value="settings" className="p-6">
                  <FunnelSettings
                    subAccountId={subaccountId}
                    defaultData={funnelPages}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
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

export default FunnelIdPage;

export const metadata = constructMetadata({
  title: "Funnel - Aexon",
});

const StatCard = ({ title, value, icon: Icon, color, iconColor, subtext }: any) => (
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
