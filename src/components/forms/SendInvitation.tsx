"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Role } from "@prisma/client";
import {
  Mail,
  Send,
  Shield,
  UserCog,
  Eye,
  Sparkles,
  ChevronRight,
  Home,
  Users,
  Key,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Crown,
  Zap,
  Waves,
} from "lucide-react";

import { saveActivityLogsNotification } from "@/queries/notifications";
import { sendInvitation } from "@/queries/invitations";

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
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Alert, AlertDescription } from "../ui/alert";

import {
  SendInvitationValidator,
  type SendInvitationSchema,
} from "@/lib/validators/send-invitation";
import { useModal } from "@/hooks/use-modal";

interface SendInvitationProps {
  agencyId: string;
}

const SendInvitation: React.FC<SendInvitationProps> = ({ agencyId }) => {
  const { setClose } = useModal();
  const [showRoleInfo, setShowRoleInfo] = React.useState(false);

  const form = useForm<SendInvitationSchema>({
    resolver: zodResolver(SendInvitationValidator),
    defaultValues: {
      email: "",
      role: Role.SUBACCOUNT_USER,
    },
    mode: "onChange",
  });

  const isSubmitting = form.formState.isSubmitting;
  const watchEmail = form.watch("email");
  const watchRole = form.watch("role");
  const formErrors = form.formState.errors;

  // Role details for display
  const roleDetails = {
    [Role.AGENCY_ADMIN]: {
      icon: Shield,
      color: "from-cyan-600 to-blue-600",
      bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
      textColor: "text-cyan-700 dark:text-cyan-300",
      description: "Full access to all agency features and settings",
      badge: "Admin",
    },
    [Role.SUBACCOUNT_USER]: {
      icon: UserCog,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      textColor: "text-blue-700 dark:text-blue-300",
      description: "Can manage assigned subaccounts and projects",
      badge: "User",
    },
    [Role.SUBACCOUNT_GUEST]: {
      icon: Eye,
      color: "from-indigo-400 to-blue-400",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
      textColor: "text-indigo-700 dark:text-indigo-300",
      description: "View-only access to specific subaccounts",
      badge: "Guest",
    },
  };

  const selectedRole = watchRole ? roleDetails[watchRole] : roleDetails[Role.SUBACCOUNT_USER];
  const RoleIcon = selectedRole?.icon || UserCog;

  const onSubmit = async (values: SendInvitationSchema) => {
    try {
      if (!values.email || values.email.trim() === "") {
        toast.error("Email is required");
        return;
      }

      if (!values.role) {
        toast.error("Role is required");
        return;
      }

      const response = await sendInvitation(
        values.role,
        values.email.trim(),
        agencyId
      );

      await saveActivityLogsNotification({
        agencyId,
        description: `Invited ${response.email} as ${values.role.toLowerCase().replace('_', ' ')}`,
        subAccountId: undefined,
      });

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Invitation sent successfully!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">An email has been sent to {values.email}</p>
          </div>
        </div>
      );
      
      setClose();
      form.reset({
        email: "",
        role: Role.SUBACCOUNT_USER,
      });
    } catch (error) {
      console.error("INVITATION ERROR:", error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not send invitation</p>
          </div>
        </div>
      );
    }
  };

  return (
    <TooltipProvider>
      <div className="relative bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Subtle background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-indigo-500/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-indigo-500/5 via-blue-500/5 to-cyan-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative">
          {/* Header with gradient */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600" />
          
          <Card className="border-0 shadow-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl overflow-hidden">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur-lg opacity-20" />
                    <div className="relative p-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg">
                      <Send className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent">
                      Send Invitation
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Invite a new member to join your agency
                    </CardDescription>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className="bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-indigo-500/5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  New Member
                </Badge>
              </div>

              {/* Quick info */}
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                <Users className="w-3 h-3" />
                <span>Users with existing invitations will not receive another</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Role Preview (when email is entered) */}
              {watchEmail && watchRole && (
                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${selectedRole.color}`}>
                      <RoleIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          Inviting {watchEmail}
                        </p>
                        <Badge className={`bg-gradient-to-r ${selectedRole.color} text-white border-0 text-xs`}>
                          {selectedRole.badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {selectedRole.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Summary */}
              {Object.keys(formErrors).length > 0 && (
                <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-sm text-red-700 dark:text-red-300">
                    Please check the form for errors
                  </AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  {/* Email Field */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium flex items-center gap-2">
                          <Mail className="w-4 h-4 text-blue-600" />
                          Email Address
                          <span className="text-red-500">*</span>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="w-3 h-3 text-slate-400" />
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p className="text-xs">Enter the email of the person you want to invite</p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="colleague@company.com"
                            className={`h-11 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${
                              formErrors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                            }`}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs text-slate-500">
                          We'll send an invitation email with setup instructions
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Role Field */}
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium flex items-center gap-2">
                          <Key className="w-4 h-4 text-indigo-600" />
                          User Role
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all">
                              <SelectValue placeholder="Select a role..." />
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
                                <Badge className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-0">
                                  Admin
                                </Badge>
                              </div>
                            </SelectItem>
                            
                            {/* Sub Account User */}
                            <SelectItem value={Role.SUBACCOUNT_USER} className="py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                  <UserCog className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">Sub Account User</p>
                                  <p className="text-xs text-slate-500">Can manage assigned subaccounts</p>
                                </div>
                                <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0">
                                  User
                                </Badge>
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
                                <Badge className="bg-gradient-to-r from-indigo-400 to-blue-400 text-white border-0">
                                  Guest
                                </Badge>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {/* Role Description (when role is selected) */}
                        {watchRole && (
                          <FormDescription className="text-xs text-slate-500 mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex items-start gap-2">
                              <div className={`p-1 rounded-full bg-gradient-to-r ${selectedRole.color} mt-0.5`}>
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              </div>
                              <span>{selectedRole.description}</span>
                            </div>
                          </FormDescription>
                        )}
                        
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator className="bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setClose()}
                      className="px-6 h-11 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      isLoading={isSubmitting}
                      className="px-6 h-11 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-700 hover:via-cyan-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/20 transition-all"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send Invitation
                    </Button>
                  </div>
                </form>
              </Form>

              {/* Additional Info */}
              <div className="text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3" />
                  Invitations expire after 7 days
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default SendInvitation;