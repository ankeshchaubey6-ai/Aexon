"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NumberInput } from "@tremor/react";
import { Role, type Agency } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Upload,
  Save,
  Sparkles,
  ChevronRight,
  Home,
  Briefcase,
  Landmark,
  Store,
  Palette,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingUp,
  Users,
  Target,
  Shield,
  Zap,
  Crown,
  Rocket,
  Gem,
  Waves,
  Anchor,
  Compass,
  Droplets,
} from "lucide-react";

import {
  deleteAgency,
  updateAgencyDetails,
  upsertAgency,
} from "@/queries/agency";
import { saveActivityLogsNotification } from "@/queries/notifications";
import { initUser } from "@/queries/auth";

import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import FileUpload from "../common/FileUpload";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Separator } from "../ui/separator";
import { Progress } from "../ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Alert, AlertDescription } from "../ui/alert";

import {
  AgencyDetailsValidator,
  type AgencyDetailsSchema,
} from "@/lib/validators/agency-details";

interface AgencyDetailsProps {
  data?: Partial<Agency>;
}

const AgencyDetails: React.FC<AgencyDetailsProps> = ({ data }) => {
  const router = useRouter();
  const [deletingAgency, setDeletingAgency] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [formProgress, setFormProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const form = useForm<AgencyDetailsSchema>({
    mode: "onChange",
    resolver: zodResolver(AgencyDetailsValidator),
    defaultValues: {
      name: data?.name ?? "",
      companyEmail: data?.companyEmail ?? "",
      companyPhone: data?.companyPhone ?? "",
      whiteLabel: data?.whiteLabel ?? false,
      address: data?.address ?? "",
      city: data?.city ?? "",
      zipCode: data?.zipCode ?? "",
      state: data?.state ?? "",
      country: data?.country ?? "",
      agencyLogo: data?.agencyLogo ?? "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;
  const watchLogo = form.watch("agencyLogo");
  const watchName = form.watch("name");
  const watchEmail = form.watch("companyEmail");
  const formValues = form.watch();
  const formErrors = form.formState.errors;

  // Update validation errors when form errors change
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

  // Calculate form completion progress
  useEffect(() => {
    const requiredFields = ['name', 'companyEmail', 'address', 'city', 'state', 'country', 'zipCode'];
    const filledFields = requiredFields.filter(field => formValues[field as keyof typeof formValues]?.toString().trim());
    setFormProgress((filledFields.length / requiredFields.length) * 100);
  }, [formValues]);

  useEffect(() => {
    if (data) {
      form.reset({
        name: data.name ?? "",
        companyEmail: data.companyEmail ?? "",
        companyPhone: data.companyPhone ?? "",
        whiteLabel: data.whiteLabel ?? false,
        address: data.address ?? "",
        city: data.city ?? "",
        zipCode: data.zipCode ?? "",
        state: data.state ?? "",
        country: data.country ?? "",
        agencyLogo: data.agencyLogo ?? "",
      });
    }
  }, [data, form]);

  // Function to check if a tab has errors
  const hasTabErrors = (tabName: string) => {
    if (tabName === "basic") return !!(formErrors.name || formErrors.companyEmail || formErrors.companyPhone);
    if (tabName === "branding") return !!formErrors.agencyLogo;
    if (tabName === "address") return !!(formErrors.address || formErrors.city || formErrors.state || formErrors.zipCode || formErrors.country);
    return false;
  };

  const onSubmit: SubmitHandler<AgencyDetailsSchema> = async (values) => {
    try {
      // Check for required fields manually before submission
      const requiredFields = [
        { field: "name", label: "Agency name", tab: "basic" },
        { field: "companyEmail", label: "Business email", tab: "basic" },
        { field: "address", label: "Street address", tab: "address" },
        { field: "city", label: "City", tab: "address" },
        { field: "state", label: "State", tab: "address" },
        { field: "zipCode", label: "Zip code", tab: "address" },
        { field: "country", label: "Country", tab: "address" }
      ];

      const missingFields = requiredFields.filter(f => !values[f.field as keyof typeof values]?.toString().trim());
      
      if (missingFields.length > 0) {
        const missingFieldNames = missingFields.map(f => f.label).join(", ");
        toast.error(`Please fill in required fields: ${missingFieldNames}`);
        
        // Switch to the first tab that has a missing field
        const firstMissingTab = missingFields[0]?.tab;
        if (firstMissingTab) {
          setActiveTab(firstMissingTab);
        }
        return;
      }

      let customerId: string | undefined;

      if (!data?.id) {
        const bodyData = {
          email: values.companyEmail,
          name: values.name,
          shipping: {
            address: {
              city: values.city,
              country: values.country,
              line1: values.address,
              postal_code: values.zipCode,
              state: values.state,
            },
            name: values.name,
          },
          address: {
            city: values.city,
            country: values.country,
            line1: values.address,
            postal_code: values.zipCode,
            state: values.state,
          },
        };

        const customerResponse = await fetch("/api/razorpay/create-customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyData),
        });

        if (!customerResponse.ok) {
          toast.error("Customer creation failed. Please check your details.");
          return;
        }

        const customerData: { customerId: string } = await customerResponse.json();
        customerId = customerData.customerId;
      }

      if (!data?.customerId && !customerId) {
        toast.error("Customer creation failed.");
        return;
      }

      const response = await upsertAgency({
        id: data?.id ?? uuidv4(),
        customerId: data?.customerId || customerId || "",
        address: values.address,
        agencyLogo: values.agencyLogo || "",
        city: values.city,
        companyPhone: values.companyPhone,
        country: values.country,
        name: values.name,
        state: values.state,
        whiteLabel: values.whiteLabel,
        zipCode: values.zipCode,
        createdAt: new Date(),
        updatedAt: new Date(),
        companyEmail: values.companyEmail,
        connectAccountId: null,
        goal: data?.goal ?? 5,
        razorpayAccountId: null,
        razorpayCustomerId: null,
      });

      if (!response) {
        toast.error("Agency creation failed.");
        return;
      }

      await initUser({
        role: Role.AGENCY_OWNER,
        agencyId: response.id,
      });

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Agency Created Successfully!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Your agency is ready to use 🚀</p>
          </div>
        </div>
      );
      
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not create your agency. Please try again.</p>
          </div>
        </div>
      );
    }
  };

  const handleDeleteAgency = async () => {
    if (!data?.id) return;

    setDeletingAgency(true);

    try {
      await deleteAgency(data.id);

      toast.success("Deleted Agency", {
        description: "Deleted your agency and all related subaccounts.",
      });

      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Oppse!", {
        description: "Could not delete your agency. Please try again.",
      });
    }

    setDeletingAgency(false);
  };

  return (
    <TooltipProvider>
      {/* Remove fixed height and overflow from the main container */}
      <div className="relative bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
        {/* Blue-themed animated background - Reduced intensity */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-indigo-500/10 via-blue-500/10 to-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-cyan-500/5 via-blue-500/5 to-indigo-500/5 rounded-full blur-3xl" />
        </div>

        {/* Decorative grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M54%201v4h-4M30%201v4h-4M6%201v4H2M54%2029v4h-4M30%2029v4h-4M6%2029v4H2M54%2055v4h-4M30%2055v4h-4M6%2055v4H2%22%20stroke%3D%22%239C92AC%22%20stroke-width%3D%220.5%22%20fill%3D%22none%22%20opacity%3D%220.02%22%2F%3E%3C%2Fsvg%3E')] opacity-10 pointer-events-none" />

        {/* Main Content - No fixed height, let it scroll naturally */}
        <div className="relative p-4 md:p-6 pb-16">
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumb and Header - Fixed at top */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-3">
                <Home className="w-4 h-4" />
                <ChevronRight className="w-3 h-3" />
                <span className="text-slate-900 dark:text-white font-medium">Agency Setup</span>
              </div>
              
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 dark:from-blue-400 dark:via-cyan-400 dark:to-indigo-400 bg-clip-text text-transparent">
                    {data?.id ? "Edit Agency" : "Create Your Agency"}
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
                    Set up your agency profile to start managing sub-accounts and delivering exceptional service to your clients.
                  </p>
                </div>

                <Badge variant="outline" className="px-4 py-2 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-indigo-500/5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                  <Waves className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                  Premium Agency Setup
                </Badge>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Profile Completion</span>
                  <span className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {Math.round(formProgress)}%
                  </span>
                </div>
                <Progress 
                  value={formProgress} 
                  className="h-2 bg-slate-100 dark:bg-slate-800 [&>div]:bg-gradient-to-r [&>div]:from-blue-600 [&>div]:via-cyan-600 [&>div]:to-indigo-600"
                />
              </div>
            </div>

            {/* Validation Summary - Shows all errors at the top */}
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

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column - Preview Card (Sticky but not too tall) */}
              <div className="lg:col-span-1">
                <div className="sticky top-6 space-y-6">
                  {/* Agency Preview */}
                  <Card className="border-0 shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
                    <div className="h-24 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 relative">
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%20fill-rule%3D%22evenodd%22%3E%3Ccircle%20cx%3D%223%22%20cy%3D%223%22%20r%3D%223%22%2F%3E%3Ccircle%20cx%3D%2213%22%20cy%3D%2213%22%20r%3D%223%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-20" />
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
                        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 shadow-xl flex items-center justify-center">
                          {watchLogo ? (
                            <img src={watchLogo} alt="Logo" className="w-12 h-12 rounded-xl object-cover" />
                          ) : (
                            <Droplets className="w-8 h-8 text-blue-600" />
                          )}
                        </div>
                      </div>
                    </div>
                    <CardContent className="relative pt-8 px-6 pb-6">
                      <div className="text-center space-y-4">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {watchName || "Agency Name"}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {watchEmail || "agency@email.com"}
                          </p>
                        </div>

                        <div className="flex justify-center gap-2">
                          <Badge className="bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 text-blue-700 dark:text-blue-300 border-0">
                            <Shield className="w-3 h-3 mr-1" />
                            {formValues.whiteLabel ? 'White Label' : 'Standard'}
                          </Badge>
                          {data?.id && (
                            <Badge className="bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-700 dark:text-emerald-300 border-0">
                              <Zap className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>

                        <Separator className="bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="flex justify-center mb-1">
                              <Users className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">0</div>
                            <div className="text-xs text-slate-500">Sub-accounts</div>
                          </div>
                          <div className="text-center">
                            <div className="flex justify-center mb-1">
                              <Users className="w-4 h-4 text-cyan-600" />
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">1</div>
                            <div className="text-xs text-slate-500">Team</div>
                          </div>
                          <div className="text-center">
                            <div className="flex justify-center mb-1">
                              <Target className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">${data?.goal || 5}k</div>
                            <div className="text-xs text-slate-500">Goal</div>
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
                          <span className="text-sm text-slate-600 dark:text-slate-400">Setup Progress</span>
                          <span className="text-sm font-semibold text-blue-600">{Math.round(formProgress)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Fields Completed</span>
                          <span className="text-sm font-semibold text-cyan-600">
                            {Object.keys(formValues).filter(k => formValues[k as keyof typeof formValues]?.toString().trim()).length}/10
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Agency Tier</span>
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                            <Crown className="w-3 h-3 mr-1" />
                            Premium
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Delete Agency (if editing) */}
                  {data?.id && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white border-0 shadow-lg shadow-rose-600/20"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Agency
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-rose-600" />
                            Delete Agency
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your
                            agency and all associated sub-accounts and data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAgency}
                            disabled={deletingAgency}
                            className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700"
                          >
                            {deletingAgency ? "Deleting..." : "Delete Agency"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>

              {/* Right Column - Form */}
              <div className="lg:col-span-2">
                <Card className="border-0 shadow-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
                  <CardHeader>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl">
                        <TabsTrigger 
                          value="basic"
                          className={`rounded-xl relative transition-all duration-300 ${
                            hasTabErrors("basic") 
                              ? "border-2 border-red-500 text-red-600 dark:text-red-400" 
                              : activeTab === "basic"
                              ? "bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 text-white"
                              : ""
                          }`}
                        >
                          <Building2 className="w-4 h-4 mr-2" />
                          Basic Info
                          {hasTabErrors("basic") && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                          )}
                        </TabsTrigger>
                        <TabsTrigger 
                          value="branding"
                          className={`rounded-xl relative transition-all duration-300 ${
                            hasTabErrors("branding") 
                              ? "border-2 border-red-500 text-red-600 dark:text-red-400" 
                              : activeTab === "branding"
                              ? "bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 text-white"
                              : ""
                          }`}
                        >
                          <Palette className="w-4 h-4 mr-2" />
                          Branding
                          {hasTabErrors("branding") && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                          )}
                        </TabsTrigger>
                        <TabsTrigger 
                          value="address"
                          className={`rounded-xl relative transition-all duration-300 ${
                            hasTabErrors("address") 
                              ? "border-2 border-red-500 text-red-600 dark:text-red-400" 
                              : activeTab === "address"
                              ? "bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 text-white"
                              : ""
                          }`}
                        >
                          <MapPin className="w-4 h-4 mr-2" />
                          Address
                          {hasTabErrors("address") && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                          )}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardHeader>

                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {/* Basic Info Tab */}
                        {activeTab === "basic" && (
                          <div className="space-y-6">
                            <div className="grid gap-6">
                              {/* Name */}
                              <div>
                                <FormField
                                  control={form.control}
                                  name="name"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-base font-semibold flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-blue-600" />
                                        Agency Name
                                        <span className="text-red-500 ml-1">*</span>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <HelpCircle className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Your official business name</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="Enter agency name"
                                          className={`h-12 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-base transition-all duration-200 bg-white dark:bg-slate-950 ${
                                            formErrors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "hover:border-blue-300"
                                          }`}
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage className="text-red-500 font-medium" />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              {/* Email */}
                              <div>
                                <FormField
                                  control={form.control}
                                  name="companyEmail"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-base font-semibold flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-cyan-600" />
                                        Business Email
                                        <span className="text-red-500 ml-1">*</span>
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          type="email"
                                          placeholder="agency@example.com"
                                          className={`h-12 border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-xl text-base transition-all duration-200 bg-white dark:bg-slate-950 ${
                                            formErrors.companyEmail ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "hover:border-cyan-300"
                                          }`}
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage className="text-red-500 font-medium" />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              {/* Phone */}
                              <div>
                                <FormField
                                  control={form.control}
                                  name="companyPhone"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-base font-semibold flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-indigo-600" />
                                        Phone Number
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="+1 (555) 000-0000"
                                          className={`h-12 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-base transition-all duration-200 bg-white dark:bg-slate-950 ${
                                            formErrors.companyPhone ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "hover:border-indigo-300"
                                          }`}
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage className="text-red-500 font-medium" />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              {/* White Label Switch */}
                              <div className="p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-xl border border-slate-200 dark:border-slate-700">
                                <FormField
                                  control={form.control}
                                  name="whiteLabel"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between">
                                      <div className="space-y-1">
                                        <FormLabel className="text-base font-semibold flex items-center gap-2">
                                          <Crown className="w-4 h-4 text-blue-600" />
                                          White Label Agency
                                        </FormLabel>
                                        <FormDescription className="text-slate-500">
                                          Remove our branding from client dashboards
                                        </FormDescription>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-600 data-[state=checked]:via-cyan-600 data-[state=checked]:to-indigo-600"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Branding Tab */}
                        {activeTab === "branding" && (
                          <div className="space-y-6">
                            <div className="p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-xl border border-slate-200 dark:border-slate-700">
                              <FormField
                                control={form.control}
                                name="agencyLogo"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-base font-semibold flex items-center gap-2">
                                      <Upload className="w-4 h-4 text-blue-600" />
                                      Agency Logo
                                    </FormLabel>
                                    <FormControl>
                                      <div className={`mt-2 p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 ${
                                        formErrors.agencyLogo ? "border-red-500" : "hover:border-blue-300 dark:hover:border-blue-700"
                                      } transition-colors duration-200`}>
                                        <FileUpload
                                          value={field.value || ""}
                                          onChange={(url) => field.onChange(url ?? "")}
                                        />
                                      </div>
                                    </FormControl>
                                    <FormDescription className="text-sm text-slate-500">
                                      Recommended size: 512x512px. Max size: 2MB
                                    </FormDescription>
                                    <FormMessage className="text-red-500 font-medium" />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        )}

                        {/* Address Tab */}
                        {activeTab === "address" && (
                          <div className="space-y-6">
                            <div className="p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-xl border border-slate-200 dark:border-slate-700">
                              <div className="space-y-6">
                                <FormField
                                  control={form.control}
                                  name="address"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-base font-semibold flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-blue-600" />
                                        Street Address
                                        <span className="text-red-500 ml-1">*</span>
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="123 Business Ave"
                                          className={`h-12 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-base transition-all duration-200 bg-white dark:bg-slate-950 ${
                                            formErrors.address ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "hover:border-blue-300"
                                          }`}
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage className="text-red-500 font-medium" />
                                    </FormItem>
                                  )}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                  <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">
                                          City
                                          <span className="text-red-500 ml-1">*</span>
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="City"
                                            className={`h-11 border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-lg bg-white dark:bg-slate-950 ${
                                              formErrors.city ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "hover:border-cyan-300"
                                            }`}
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage className="text-red-500 font-medium" />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name="state"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">
                                          State
                                          <span className="text-red-500 ml-1">*</span>
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="State"
                                            className={`h-11 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-lg bg-white dark:bg-slate-950 ${
                                              formErrors.state ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "hover:border-indigo-300"
                                            }`}
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage className="text-red-500 font-medium" />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <FormField
                                    control={form.control}
                                    name="zipCode"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">
                                          Zip Code
                                          <span className="text-red-500 ml-1">*</span>
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="Zip Code"
                                            className={`h-11 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg bg-white dark:bg-slate-950 ${
                                              formErrors.zipCode ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "hover:border-blue-300"
                                            }`}
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage className="text-red-500 font-medium" />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name="country"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">
                                          Country
                                          <span className="text-red-500 ml-1">*</span>
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="Country"
                                            className={`h-11 border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-lg bg-white dark:bg-slate-950 ${
                                              formErrors.country ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "hover:border-cyan-300"
                                            }`}
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage className="text-red-500 font-medium" />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Form Actions */}
                        <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => router.back()}
                            className="h-11 px-6 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            isLoading={isSubmitting}
                            disabled={isSubmitting}
                            className="h-11 px-8 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-700 hover:via-cyan-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-200 font-semibold"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            {data?.id ? "Update Agency" : "Create Agency"}
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

export default AgencyDetails;