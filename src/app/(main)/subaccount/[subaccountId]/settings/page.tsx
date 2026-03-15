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
  Award,
  DollarSign,
  Target,
  BarChart3,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Link2,
  Key,
  Lock
} from "lucide-react";

import { getAuthUserDetails } from "@/queries/auth";
import { getSubAccountDetails } from "@/queries/subaccount";
import { getAgencyDetails } from "@/queries/agency";

import BlurPage from "@/components/common/BlurPage";
import SubAccountDetails from "@/components/forms/SubAccountDetails";
import { Agency } from "@prisma/client";
import { constructMetadata } from "@/lib/utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SubAccountSettingsPageProps {
  params: {
    subaccountId: string | undefined;
  };
}

const SubAccountSettingsPage: React.FC<SubAccountSettingsPageProps> = async ({
  params,
}) => {
  const { subaccountId } = params;
  const authUser = await currentUser();

  if (!subaccountId) redirect("/subaccount/unauthorized");
  if (!authUser) redirect("/agency/sign-in");

  const userDetails = await getAuthUserDetails();
  if (!userDetails) redirect("/subaccount/unauthorized");

  const subAccount = await getSubAccountDetails(subaccountId);
  if (!subAccount) redirect("/subaccount/unauthorized");

  const agencyDetails = await getAgencyDetails(subAccount.agencyId);

  // Get initials
  const getSubAccountInitials = () => {
    return subAccount.name?.charAt(0).toUpperCase() || 'S';
  };

  const getAgencyInitials = () => {
    return agencyDetails?.name?.charAt(0).toUpperCase() || 'A';
  };

  return (
    <BlurPage>
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
                    <h1 className="text-2xl font-bold text-white">Sub Account Settings</h1>
                    <Badge className="bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-white border-white/10 backdrop-blur-sm px-2 py-0.5 text-xs">
                      <Crown className="w-3 h-3 mr-1 text-amber-300" />
                      Premium
                    </Badge>
                  </div>
                  <p className="text-white/70 text-xs flex items-center">
                    Manage your sub account branding and operational configuration
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
                    <span className="text-xs font-medium text-white">Sub Account</span>
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
                { icon: Building2, label: 'Settings', active: false, color: 'from-purple-500 to-pink-600' },
                { icon: Users, label: 'Team', active: false, color: 'from-pink-500 to-rose-600' },
                { icon: BarChart3, label: 'Analytics', active: false, color: 'from-amber-500 to-orange-600' },
                { icon: Target, label: 'Goals', active: false, color: 'from-emerald-500 to-teal-600' },
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
                {/* Sub Account Profile Card */}
                <Card className="border-0 bg-gradient-to-br from-[#1A1F3A] to-[#0F1425] shadow-2xl overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 shadow-inner shadow-black/50" />
                  
                  <CardContent className="p-4 relative">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-full blur-md opacity-50" />
                        <Avatar className="h-12 w-12 ring-2 ring-[#4F46E5]/30 relative">
                  
                          <AvatarFallback className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white text-sm">
                            {getSubAccountInitials()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#A5B4FC]">Sub Account</p>
                        <p className="text-sm font-semibold text-white truncate">
                          {subAccount.name}
                        </p>
                        <p className="text-xs text-white/50 truncate">
                          ID: {subaccountId.slice(0, 8)}...
                        </p>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="mt-3 space-y-1.5">
                      {subAccount.companyEmail && (
                        <div className="flex items-center gap-1.5 text-xs text-white/60">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{subAccount.companyEmail}</span>
                        </div>
                      )}
                      {subAccount.companyPhone && (
                        <div className="flex items-center gap-1.5 text-xs text-white/60">
                          <Phone className="w-3 h-3" />
                          <span>{subAccount.companyPhone}</span>
                        </div>
                      )}
                      {subAccount.address && (
                        <div className="flex items-center gap-1.5 text-xs text-white/60">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{subAccount.address}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Agency Info Card */}
                {agencyDetails && (
                  <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/80 to-[#0F1425]/80 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <CardContent className="p-4 relative">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="p-1.5 bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-lg shadow-lg">
                          <Building2 className="w-3.5 h-3.5 text-white" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">Parent Agency</h3>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white text-xs">
                            {getAgencyInitials()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-white">{agencyDetails.name}</p>
                          <p className="text-[10px] text-white/40">{agencyDetails.city || 'No location'}</p>
                        </div>
                      </div>

                      {/* Agency Stats */}
                      <div className="grid grid-cols-2 gap-1 mt-3">
                        <div className="text-center p-1 rounded-lg bg-white/5">
                          <div className="text-xs font-bold text-transparent bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text">
                            {agencyDetails.subAccounts?.length || 0}
                          </div>
                          <div className="text-[8px] text-white/40">Sub Accounts</div>
                        </div>
                        <div className="text-center p-1 rounded-lg bg-white/5">
                          <div className="text-xs font-bold text-transparent bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text">
                            Active
                          </div>
                          <div className="text-[8px] text-white/40">Status</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quick Stats Card */}
                <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#4F46E5]" />
                      Quick Stats
                    </h3>
                    <div className="space-y-2">
                      {[
                        { label: 'Monthly Revenue', value: '$12.5k', icon: DollarSign, color: 'from-emerald-500 to-teal-500' },
                        { label: 'Active Projects', value: '8', icon: Target, color: 'from-blue-500 to-cyan-500' },
                        { label: 'Team Members', value: '12', icon: Users, color: 'from-purple-500 to-pink-500' },
                        { label: 'Conversion Rate', value: '24%', icon: TrendingUp, color: 'from-amber-500 to-orange-500' },
                      ].map((stat, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded-md bg-gradient-to-r ${stat.color} bg-opacity-20`}>
                              <stat.icon className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs text-white/70">{stat.label}</span>
                          </div>
                          <span className="text-xs font-semibold text-white">{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Security Status */}
                <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[#4F46E5]" />
                        Security
                      </h3>
                      <Badge className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border-0 text-[10px]">
                        <Lock className="w-2 h-2 mr-1" />
                        Secured
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/60">2FA Status</span>
                        <span className="text-emerald-400 font-medium">Enabled</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/60">Last Backup</span>
                        <span className="text-white/80">2 hours ago</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/60">API Access</span>
                        <span className="text-white/80">Active</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Main Settings Content */}
            <div className="lg:col-span-3">
              <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#DB2777]" />
                
                <CardHeader className="border-b border-white/10 bg-white/5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-xl shadow-lg">
                        <Settings className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-white">Sub Account Configuration</CardTitle>
                        <CardDescription className="text-xs text-white/50">
                          Manage your sub account settings, branding and preferences
                        </CardDescription>
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <Badge className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1">
                      <Activity className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <SubAccountDetails
                    agencyDetails={agencyDetails as Agency}
                    details={subAccount}
                    userId={userDetails.id}
                    userName={userDetails.name}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        
      </div>
    </BlurPage>
  );
};

export default SubAccountSettingsPage;

export const metadata = constructMetadata({
  title: "Sub Account Settings - Aexon",
});