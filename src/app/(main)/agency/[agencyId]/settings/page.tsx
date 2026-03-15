import React from "react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { 
  Settings, 
  Building2, 
  UserCircle, 
  Shield, 
  Globe, 
  Bell,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
  Users,
  Zap,
  Crown,
  Activity,
  TrendingUp,
  Clock,
  Award
} from "lucide-react";

import { getAuthUser } from "@/queries/auth";
import { getAgencyDetails } from "@/queries/agency";

import AgencyDetails from "@/components/forms/AgencyDetails";
import UserDetailsForm from "@/components/forms/UserDetails";
import { constructMetadata } from "@/lib/utils";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AgencySettingsPageProps {
  params: {
    agencyId: string | undefined;
  };
}

const AgencySettingsPage: React.FC<AgencySettingsPageProps> = async ({
  params,
}) => {
  const { agencyId } = params;
  const authUser = await currentUser();

  if (!authUser) redirect("/agency/sign-in");
  if (!agencyId) redirect("/agency/unauthorized");

  const userDetails = await getAuthUser(
    authUser.emailAddresses[0].emailAddress
  );

  if (!userDetails) redirect("/agency/sign-in");

  const agencyDetails = await getAgencyDetails(agencyId);

  if (!agencyDetails) redirect("/agency/unauthorized");

  const subAccounts = agencyDetails.subAccounts;

  // Get initials for avatar
  const getUserInitials = () => {
    const firstName = userDetails.name?.split(' ')[0] || '';
    const lastName = userDetails.name?.split(' ')[1] || '';
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  };

  const getAgencyInitials = () => {
    return agencyDetails.name?.charAt(0).toUpperCase() || 'A';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0F1E] via-[#0F1425] to-[#0A0F1E]">
      {/* Premium Header with Advanced Glass Effect */}
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
                  <Settings className="w-5 h-5 text-white" />
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">Settings</h1>
                  <Badge className="bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-white border-white/10 backdrop-blur-sm px-2 py-0.5 text-xs">
                    <Crown className="w-3 h-3 mr-1 text-amber-300" />
                    Enterprise
                  </Badge>
                </div>
                <p className="text-white/70 text-xs flex items-center">
                  Manage your agency settings and preferences
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
                  <Building2 className="w-3.5 h-3.5 text-white/60" />
                  <span className="text-xs font-medium text-white">{subAccounts?.length || 0}</span>
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
              { icon: LayoutDashboard, label: 'Overview', active: true, color: 'from-indigo-500 to-purple-600' },
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

            {/* Premium Badge */}
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
                  <span className="text-[10px] font-medium text-emerald-400">LIVE</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              {/* User Profile Card - Premium Neumorphism */}
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A] to-[#0F1425] shadow-2xl overflow-hidden relative group">
                {/* Neumorphic Shadows */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 shadow-inner shadow-black/50" />
                
                <CardContent className="p-4 relative">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-full blur-md opacity-50" />
                      <Avatar className="h-12 w-12 ring-2 ring-[#4F46E5]/30 relative">
                        <AvatarImage src={authUser.imageUrl} />
                        <AvatarFallback className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white text-sm">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#A5B4FC]">Signed in as</p>
                      <p className="text-sm font-semibold text-white truncate">
                        {userDetails.name}
                      </p>
                      <p className="text-xs text-white/50 truncate">
                        {authUser.emailAddresses[0].emailAddress}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Agency Info Card - Glassmorphism */}
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/80 to-[#0F1425]/80 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <CardContent className="p-4 relative">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-lg shadow-lg">
                      <Building2 className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Agency Details</h3>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white text-xs">
                        {getAgencyInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-white">{agencyDetails.name}</p>
                      <p className="text-[10px] text-white/40">ID: {agencyId.slice(0, 6)}...</p>
                    </div>
                  </div>

                  {/* Mini Stats */}
                  <div className="grid grid-cols-3 gap-1 mt-3">
                    {[
                      { label: 'Projects', value: '12', color: 'from-blue-500 to-cyan-500' },
                      { label: 'Team', value: '5', color: 'from-purple-500 to-pink-500' },
                      { label: 'Clients', value: '3', color: 'from-amber-500 to-orange-500' },
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

              {/* Quick Links - Advanced Glass with Neumorphic Elements */}
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl">
                <CardContent className="p-2">
                  {[
                    { icon: Building2, label: 'Agency Settings', active: true, gradient: 'from-[#4F46E5] to-[#7C3AED]' },
                    { icon: UserCircle, label: 'Profile Settings', active: false, gradient: 'from-[#EC4899] to-[#DB2777]' },
                    { icon: Shield, label: 'Security', active: false, gradient: 'from-[#10B981] to-[#059669]' },
                    { icon: Bell, label: 'Notifications', active: false, gradient: 'from-[#F59E0B] to-[#D97706]' },
                    { icon: Globe, label: 'Preferences', active: false, gradient: 'from-[#6366F1] to-[#4F46E5]' },
                  ].map((item, index) => (
                    <button
                      key={index}
                      className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg transition-all duration-200 relative group ${
                        item.active ? 'text-white' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {/* Active Background with Neumorphism */}
                      {item.active && (
                        <>
                          <div className={`absolute inset-0 bg-gradient-to-r ${item.gradient} rounded-lg opacity-20`} />
                          <div className="absolute inset-0 bg-white/5 backdrop-blur-sm rounded-lg" />
                          <div className="absolute inset-0 shadow-inner shadow-white/10 rounded-lg" />
                        </>
                      )}
                      
                      {/* Hover Effect */}
                      {!item.active && (
                        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-lg transition-all duration-200" />
                      )}
                      
                      {/* Content */}
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
            </div>
          </div>

          {/* Main Settings Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tabs Navigation - Premium Design */}
            <Tabs defaultValue="agency" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-1 bg-[#1A1F3A]/90 backdrop-blur-xl rounded-xl border border-white/10">
                <TabsTrigger 
                  value="agency"
                  className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#4F46E5] data-[state=active]:to-[#7C3AED] data-[state=active]:text-white text-white/70 text-sm py-2 transition-all duration-200"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Agency Settings
                </TabsTrigger>
                <TabsTrigger 
                  value="profile"
                  className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#EC4899] data-[state=active]:to-[#DB2777] data-[state=active]:text-white text-white/70 text-sm py-2 transition-all duration-200"
                >
                  <UserCircle className="w-4 h-4 mr-2" />
                  Profile Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="agency" className="mt-4">
                <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                  <CardHeader className="border-b border-white/10 bg-white/5 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-lg">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base text-white">Agency Configuration</CardTitle>
                        <CardDescription className="text-xs text-white/50">
                          Manage your agency's core settings and branding
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <AgencyDetails data={agencyDetails} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="profile" className="mt-4">
                <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                  <CardHeader className="border-b border-white/10 bg-white/5 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-gradient-to-br from-[#EC4899] to-[#DB2777] rounded-lg">
                        <UserCircle className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base text-white">Profile Settings</CardTitle>
                        <CardDescription className="text-xs text-white/50">
                          Update your personal information and preferences
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <UserDetailsForm
                      type="agency"
                      id={agencyId}
                      subAccounts={subAccounts}
                      userData={userDetails}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

     
    </div>
  );
};

export default AgencySettingsPage;

export const metadata = constructMetadata({
  title: "Settings - Aexon",
});