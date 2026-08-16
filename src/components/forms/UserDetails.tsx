"use client";

import React, { useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Role, type SubAccount, type User as PrismaUser } from "@prisma/client";
import {
  User as UserIcon,
  Mail,
  Upload,
  Save,
  Shield,
  ChevronRight,
  Home,
  Crown,
  Sparkles,
  HelpCircle,
  UserCog,
  Key,
  Lock,
  Building2,
  Phone,
  AlertCircle,
  Eye,
  Briefcase,
  Target,
  Users,
  Settings,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Fingerprint,
  Bell,
  Globe,
  Zap,
  Layers,
  Award,
  Star,
  Droplets,
  Waves,
  Compass,
  Anchor,
  TrendingUp,
} from "lucide-react";

import { updateUser } from "@/queries/auth";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import FileUpload from "../common/FileUpload";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Alert, AlertDescription } from "../ui/alert";
import { Progress } from "../ui/progress";

import { useModal } from "@/hooks/use-modal";
import {
  type UserDataSchema,
  UserDataValidator,
} from "@/lib/validators/user-data";

interface UserDetailsProps {
  id: string | null;
  type: "agency" | "subaccount";
  userData?: Partial<PrismaUser>;
  subAccounts?: SubAccount[];
}

const UserDetailsForm: React.FC<UserDetailsProps> = ({
  id,
  type,
  subAccounts,
  userData,
}) => {
  const router = useRouter();
  const { data: modalData, setClose } = useModal();

  const [activeTab, setActiveTab] = useState("details");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [profileCompletion, setProfileCompletion] = useState(0);

  const form = useForm<UserDataSchema>({
    resolver: zodResolver(UserDataValidator),
    defaultValues: {
      name: "",
      email: "",
      avatarUrl: "",
      role: Role.SUBACCOUNT_USER,
    },
    mode: "onChange",
  });

  // Watch form values
  const watchName = form.watch("name");
  const watchAvatar = form.watch("avatarUrl");
  const watchRole = form.watch("role");
  const watchEmail = form.watch("email");
  const formErrors = form.formState.errors;
  const formValues = form.watch();

  // Check if current user is agency owner
  const isAgencyOwner = React.useMemo(() => {
    const currentUser = modalData?.user || userData;
    return currentUser?.role === Role.AGENCY_OWNER;
  }, [modalData, userData]);

  // Calculate profile completion
  useEffect(() => {
    let completed = 0;
    const total = 3;
    if (watchName) completed++;
    if (watchEmail) completed++;
    if (watchAvatar) completed++;
    setProfileCompletion((completed / total) * 100);
  }, [watchName, watchEmail, watchAvatar]);

  // Update validation errors
  useEffect(() => {
    const errors: Record<string, string> = {};
    Object.keys(formErrors).forEach((key) => {
      const errorKey = key as keyof typeof formErrors;
      if (formErrors[errorKey]?.message) {
        errors[key] = formErrors[errorKey]?.message || "";
      }
    });
    setValidationErrors(errors);
  }, [formErrors]);

  useEffect(() => {
    const sourceUser = modalData?.user || userData;

    if (sourceUser) {
      form.reset({
        name: sourceUser.name ?? "",
        email: sourceUser.email ?? "",
        avatarUrl: sourceUser.avatarUrl ?? "",
        role: sourceUser.role ?? Role.SUBACCOUNT_USER,
      });
    }
  }, [modalData, userData, form]);

  const onSubmit: SubmitHandler<UserDataSchema> = async (values) => {
    try {
      if (!values.name?.trim()) {
        toast.error("Name is required");
        return;
      }

      const targetUser = modalData?.user || userData;

      if (!targetUser?.id) {
        toast.error("User ID not found");
        return;
      }

      const payload = {
        id: targetUser.id,
        name: values.name,
        email: values.email,
        avatarUrl:
          values.avatarUrl && values.avatarUrl !== ""
            ? values.avatarUrl
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(values.name)}&background=3b82f6&color=fff&bold=true`,
        role: values.role,
      };

      const updatedUser = await updateUser(payload);

      if (!updatedUser) {
        throw new Error("Update failed");
      }

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">User information updated successfully!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Changes have been saved</p>
          </div>
        </div>
      );
      
      setClose();
      router.refresh();
    } catch (error) {
      console.error("UPDATE ERROR:", error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not update user information</p>
          </div>
        </div>
      );
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  // Role details mapping with agency colors
  const roleDetails = {
    [Role.AGENCY_OWNER]: {
      color: "from-blue-600 to-indigo-600",
      icon: Crown,
      label: "Agency Owner",
      description: "Full ownership and control over the agency",
      badge: "bg-gradient-to-r from-blue-600 to-indigo-600"
    },
    [Role.AGENCY_ADMIN]: {
      color: "from-cyan-600 to-blue-600",
      icon: Shield,
      label: "Agency Admin",
      description: "Full access to all agency features",
      badge: "bg-gradient-to-r from-cyan-600 to-blue-600"
    },
    [Role.SUBACCOUNT_USER]: {
      color: "from-blue-500 to-cyan-500",
      icon: UserIcon,
      label: "Sub Account User",
      description: "Can manage assigned subaccounts",
      badge: "bg-gradient-to-r from-blue-500 to-cyan-500"
    },
    [Role.SUBACCOUNT_GUEST]: {
      color: "from-indigo-400 to-blue-400",
      icon: Eye,
      label: "Sub Account Guest",
      description: "View-only access to subaccounts",
      badge: "bg-gradient-to-r from-indigo-400 to-blue-400"
    }
  };

  const currentRole = roleDetails[watchRole as keyof typeof roleDetails] || roleDetails[Role.SUBACCOUNT_USER];
  const RoleIcon = currentRole.icon;

  return (
    <TooltipProvider>
      <div className="relative bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
        {/* Blue-themed animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-indigo-500/10 via-blue-500/10 to-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-cyan-500/5 via-blue-500/5 to-indigo-500/5 rounded-full blur-3xl" />
        </div>

        {/* Decorative grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M54%201v4h-4M30%201v4h-4M6%201v4H2M54%2029v4h-4M30%2029v4h-4M6%2029v4H2M54%2055v4h-4M30%2055v4h-4M6%2055v4H2%22%20stroke%3D%22%239C92AC%22%20stroke-width%3D%220.5%22%20fill%3D%22none%22%20opacity%3D%220.02%22%2F%3E%3C%2Fsvg%3E')] opacity-10 pointer-events-none" />

        <div className="relative p-4 md:p-6 pb-16">
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
              <Home className="w-4 h-4" />
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-900 dark:text-white font-medium">
                {type === "agency" ? "Agency" : "Subaccount"}
              </span>
              <ChevronRight className="w-3 h-3" />
              <span>User Management</span>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 dark:from-blue-400 dark:via-cyan-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  User Profile
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2">
                  Manage user details and permissions
                </p>
              </div>

              <Badge variant="outline" className="px-4 py-2 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-indigo-500/5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                <Waves className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                {type === "agency" ? "Agency Access" : "Subaccount Access"}
              </Badge>
            </div>

            {/* Profile Completion Bar */}
            <div className="mb-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Profile Completion</span>
                <span className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {Math.round(profileCompletion)}%
                </span>
              </div>
              <Progress 
                value={profileCompletion} 
                className="h-2 bg-slate-100 dark:bg-slate-800 [&>div]:bg-gradient-to-r [&>div]:from-blue-600 [&>div]:via-cyan-600 [&>div]:to-indigo-600"
              />
            </div>

            {/* Validation Summary */}
            {Object.keys(validationErrors).length > 0 && (
              <Alert variant="destructive" className="mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Please fix the following errors:</div>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {Object.entries(validationErrors).map(([field, message]) => (
                      <li key={field} className="text-red-700 dark:text-red-300">
                        {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: {message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Main Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column - Profile Card */}
              <div className="lg:col-span-1">
                <div className="sticky top-6 space-y-6">
                  {/* Profile Card */}
                  <Card className="border-0 shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
                    <div className="h-24 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 relative">
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%20fill-rule%3D%22evenodd%22%3E%3Ccircle%20cx%3D%223%22%20cy%3D%223%22%20r%3D%223%22%2F%3E%3Ccircle%20cx%3D%2213%22%20cy%3D%2213%22%20r%3D%223%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-20" />
                      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur-xl opacity-50" />
                          <Avatar className="w-24 h-24 border-4 border-white dark:border-slate-900 ring-4 ring-blue-500/30 relative">
                            <AvatarImage src={watchAvatar || ""} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-3xl">
                              {watchName?.charAt(0) || <UserIcon className="w-8 h-8" />}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                    </div>

                    <CardContent className="relative pt-14 px-6 pb-6">
                      <div className="text-center space-y-4">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {watchName || "User Name"}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {watchEmail || "email@example.com"}
                          </p>
                        </div>

                        <div className="flex justify-center">
                          <Badge className={`bg-gradient-to-r ${currentRole.color} text-white border-0 px-4 py-2 shadow-lg`}>
                            <RoleIcon className="w-4 h-4 mr-2" />
                            {currentRole.label}
                          </Badge>
                        </div>

                        <Separator className="bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="flex justify-center mb-1">
                              <Briefcase className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">12</div>
                            <div className="text-xs text-slate-500">Projects</div>
                          </div>
                          <div className="text-center">
                            <div className="flex justify-center mb-1">
                              <Target className="w-4 h-4 text-cyan-600" />
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">48</div>
                            <div className="text-xs text-slate-500">Tasks</div>
                          </div>
                          <div className="text-center">
                            <div className="flex justify-center mb-1">
                              <Users className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">3</div>
                            <div className="text-xs text-slate-500">Teams</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Stats Card */}
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
                          <TrendingUp className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">Quick Stats</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Profile Completion</span>
                          <span className="text-sm font-semibold text-blue-600">{Math.round(profileCompletion)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Security Score</span>
                          <span className="text-sm font-semibold text-cyan-600">80%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Account Age</span>
                          <span className="text-sm font-semibold text-indigo-600">3 months</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Activity Card */}
                  <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
                    <CardContent className="p-6">
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        Recent Activity
                      </h4>
                      <div className="space-y-4">
                        {[
                          { action: "Profile updated", time: "2 hours ago", icon: UserIcon, color: "from-blue-600 to-cyan-600" },
                          { action: "Password changed", time: "1 day ago", icon: Lock, color: "from-cyan-600 to-indigo-600" },
                          { action: "Login from new device", time: "3 days ago", icon: Fingerprint, color: "from-indigo-600 to-blue-600" },
                        ].map((activity, index) => (
                          <div key={index} className="flex items-center gap-3 group hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-all">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${activity.color} bg-opacity-10`}>
                              <activity.icon className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{activity.action}</p>
                              <p className="text-xs text-slate-500">{activity.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Right Column - Form */}
              <div className="lg:col-span-2">
                <Card className="border-0 shadow-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
                  <CardHeader>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl">
                        <TabsTrigger 
                          value="details"
                          className={`rounded-xl transition-all duration-300 ${
                            activeTab === "details"
                              ? "bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 text-white"
                              : ""
                          }`}
                        >
                          <UserIcon className="w-4 h-4 mr-2" />
                          User Details
                        </TabsTrigger>
                        <TabsTrigger 
                          value="permissions"
                          className={`rounded-xl transition-all duration-300 ${
                            activeTab === "permissions"
                              ? "bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 text-white"
                              : ""
                          }`}
                          disabled={type !== "subaccount"}
                        >
                          <Lock className="w-4 h-4 mr-2" />
                          Permissions
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardHeader>

                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {/* User Details Tab - Always visible, controlled by activeTab */}
                        {activeTab === "details" && (
                          <div className="space-y-8">
                            {/* Profile Picture Upload */}
                            <FormField
                              control={form.control}
                              name="avatarUrl"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                                    <Upload className="w-4 h-4 text-blue-600" />
                                    Profile Picture
                                  </FormLabel>
                                  <FormControl>
                                    <div className={`p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 ${
                                      formErrors.avatarUrl ? "border-red-500" : "hover:border-blue-300 dark:hover:border-blue-700"
                                    } transition-colors duration-200`}>
                                      <FileUpload
                                        value={field.value || ""}
                                        onChange={(url) => field.onChange(url || "")}
                                      />
                                    </div>
                                  </FormControl>
                                  <FormDescription className="text-sm text-slate-500">
                                    Recommended size: 512x512px. Max size: 2MB
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <Separator className="bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

                            {/* Basic Information */}
                            <div className="space-y-6">
                              {/* Full Name */}
                              <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-base font-semibold flex items-center gap-2">
                                      <UserIcon className="w-4 h-4 text-blue-600" />
                                      Full Name
                                      <span className="text-red-500 ml-1">*</span>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <HelpCircle className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Enter the user&apos;s complete name</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        disabled={isSubmitting}
                                        placeholder="John Doe"
                                        className={`h-12 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-base transition-all duration-200 bg-white dark:bg-slate-950 ${
                                          formErrors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "hover:border-blue-300"
                                        }`}
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {/* Email (read-only) */}
                              <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-base font-semibold flex items-center gap-2">
                                      <Mail className="w-4 h-4 text-cyan-600" />
                                      Email Address
                                    </FormLabel>
                                    <FormControl>
                                      <div className="relative">
                                        <Input
                                          readOnly
                                          disabled
                                          placeholder="user@example.com"
                                          className="h-12 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-base cursor-not-allowed opacity-75"
                                          {...field}
                                        />
                                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                      </div>
                                    </FormControl>
                                    <FormDescription className="text-xs text-slate-500 flex items-center gap-1">
                                      <Lock className="w-3 h-3" />
                                      Email cannot be changed
                                    </FormDescription>
                                  </FormItem>
                                )}
                              />

                              {/* User Role */}
                              <FormField
                                control={form.control}
                                name="role"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-base font-semibold flex items-center gap-2">
                                      <Key className="w-4 h-4 text-indigo-600" />
                                      User Role
                                    </FormLabel>
                                    
                                    {isAgencyOwner ? (
                                      <div className="h-12 px-4 border-2 border-blue-200 dark:border-blue-800 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 flex items-center gap-3">
                                        <Crown className="w-5 h-5 text-blue-600" />
                                        <span className="font-medium text-slate-900 dark:text-white flex-1">Agency Owner</span>
                                        <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
                                          <Lock className="w-3 h-3 mr-1" />
                                          Locked
                                        </Badge>
                                      </div>
                                    ) : (
                                      <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        disabled={isSubmitting}
                                      >
                                        <FormControl>
                                          <SelectTrigger className="h-12 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-base hover:border-blue-300 transition-all duration-200">
                                            <SelectValue placeholder="Select a role" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {/* Agency Admin */}
                                          <SelectItem value={Role.AGENCY_ADMIN} className="py-3">
                                            <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
                                                <Shield className="w-4 h-4 text-white" />
                                              </div>
                                              <div className="flex-1">
                                                <p className="font-medium">Agency Admin</p>
                                                <p className="text-xs text-slate-500">Full access to all features</p>
                                              </div>
                                              <Badge className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white">Admin</Badge>
                                            </div>
                                          </SelectItem>
                                          
                                          {/* Sub Account User */}
                                          <SelectItem value={Role.SUBACCOUNT_USER} className="py-3">
                                            <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                                <UserIcon className="w-4 h-4 text-white" />
                                              </div>
                                              <div className="flex-1">
                                                <p className="font-medium">Sub Account User</p>
                                                <p className="text-xs text-slate-500">Can manage assigned subaccounts</p>
                                              </div>
                                              <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">User</Badge>
                                            </div>
                                          </SelectItem>
                                          
                                          {/* Sub Account Guest */}
                                          <SelectItem value={Role.SUBACCOUNT_GUEST} className="py-3">
                                            <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-blue-400 flex items-center justify-center">
                                                <Eye className="w-4 h-4 text-white" />
                                              </div>
                                              <div className="flex-1">
                                                <p className="font-medium">Sub Account Guest</p>
                                                <p className="text-xs text-slate-500">View-only access</p>
                                              </div>
                                              <Badge className="bg-gradient-to-r from-indigo-400 to-blue-400 text-white">Guest</Badge>
                                            </div>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    )}

                                    {/* Role Description */}
                                    {!isAgencyOwner && field.value && (
                                      <FormDescription className="text-sm text-slate-500 mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                        {roleDetails[field.value as keyof typeof roleDetails]?.description}
                                      </FormDescription>
                                    )}
                                  </FormItem>
                                )}
                              />
                            </div>

                            {/* Advanced Settings Toggle */}
                            <div className="pt-4">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="w-full h-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 group"
                              >
                                <Settings className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                                {showAdvanced ? "Hide" : "Show"} Advanced Settings
                              </Button>
                            </div>

                            {/* Advanced Settings */}
                            {showAdvanced && (
                              <div className="p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-xl border border-slate-200 dark:border-slate-700">
                                <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-blue-600" />
                                  Account Settings
                                </h4>
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                      <Shield className="w-4 h-4 text-slate-500" />
                                      <span className="text-sm text-slate-700 dark:text-slate-300">Two-Factor Authentication</span>
                                    </div>
                                    <Switch className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-600 data-[state=checked]:via-cyan-600 data-[state=checked]:to-indigo-600" />
                                  </div>
                                  <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                      <Bell className="w-4 h-4 text-slate-500" />
                                      <span className="text-sm text-slate-700 dark:text-slate-300">Email Notifications</span>
                                    </div>
                                    <Switch defaultChecked className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-600 data-[state=checked]:via-cyan-600 data-[state=checked]:to-indigo-600" />
                                  </div>
                                  <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                      <Globe className="w-4 h-4 text-slate-500" />
                                      <span className="text-sm text-slate-700 dark:text-slate-300">Public Profile</span>
                                    </div>
                                    <Switch className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-600 data-[state=checked]:via-cyan-600 data-[state=checked]:to-indigo-600" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Permissions Tab */}
                        {activeTab === "permissions" && (
                          <div className="space-y-6">
                            {type === "subaccount" && subAccounts && subAccounts.length > 0 ? (
                              <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                      Subaccount Access
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                      Grant or restrict access to specific subaccounts
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  {subAccounts.map((subAccount) => (
                                    <div
                                      key={subAccount.id}
                                      className="p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200 group"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center">
                                            <Building2 className="w-6 h-6 text-blue-600" />
                                          </div>
                                          <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">
                                              {subAccount.name}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                              <span className="flex items-center gap-1">
                                                <Mail className="w-3 h-3" />
                                                {subAccount.companyEmail}
                                              </span>
                                              {subAccount.companyPhone && (
                                                <>
                                                  <span>•</span>
                                                  <span className="flex items-center gap-1">
                                                    <Phone className="w-3 h-3" />
                                                    {subAccount.companyPhone}
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <Switch className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-600 data-[state=checked]:via-cyan-600 data-[state=checked]:to-indigo-600" />
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Permission Summary */}
                                <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-xl border border-blue-100 dark:border-blue-900">
                                  <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
                                      <Shield className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Permission Summary</h4>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                        Users can manage subaccounts based on their role. Agency Admins have automatic access.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-12">
                                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
                                  <Building2 className="w-8 h-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                  {type === "agency" ? "Agency Level Access" : "No Subaccounts"}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                  {type === "agency" 
                                    ? "Agency users have access to all subaccounts by default."
                                    : "This user has no subaccounts assigned."}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Form Actions - Always visible */}
                        <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setClose()}
                            className="h-11 px-6 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            isLoading={isSubmitting}
                            disabled={isSubmitting}
                            className="h-11 px-8 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-700 hover:via-cyan-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/20 hover:shadow-xl transition-all duration-200 font-semibold"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default UserDetailsForm;
