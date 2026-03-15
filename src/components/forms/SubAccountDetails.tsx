"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { type Agency } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Upload,
  Save,
  ChevronRight,
  Home,
  Store,
  Palette,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Image,
  Briefcase,
  Sparkles,
  Globe,
  Target,
  Users,
} from "lucide-react";

import { saveActivityLogsNotification } from "@/queries/notifications";
import { upsertSubAccount } from "@/queries/subaccount";

import { useModal } from "@/hooks/use-modal";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import FileUpload from "../common/FileUpload";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  type SubAccountDetailsSchema,
  SubAccountDetailsValidator,
} from "@/lib/validators/subaccount-details";

interface SubAccountDetailsProps {
  agencyDetails: Agency;
  details?: {
    id?: string;
    name?: string | null;
    companyEmail?: string | null;
    companyPhone?: string | null;
    address?: string | null;
    city?: string | null;
    zipCode?: string | null;
    state?: string | null;
    country?: string | null;
    subAccountLogo?: string | null;
    goal?: number | null;
  };
  userId: string;
  userName: string;
}

const SubAccountDetails: React.FC<SubAccountDetailsProps> = ({
  details,
  agencyDetails,
  userId,
  userName,
}) => {
  const router = useRouter();
  const { setClose } = useModal();
  const [activeTab, setActiveTab] = useState("branding");
  const [formProgress, setFormProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const defaultValues = React.useMemo<SubAccountDetailsSchema>(
    () => ({
      name: details?.name ?? "",
      companyEmail: details?.companyEmail ?? "",
      companyPhone: details?.companyPhone ?? "",
      address: details?.address ?? "",
      city: details?.city ?? "",
      zipCode: details?.zipCode ?? "",
      state: details?.state ?? "",
      country: details?.country ?? "",
      subAccountLogo: details?.subAccountLogo ?? "",
    }),
    [details]
  );

  const form = useForm<SubAccountDetailsSchema>({
    resolver: zodResolver(SubAccountDetailsValidator),
    defaultValues,
    mode: "onChange",
  });

  // Watch form values
  const watchLogo = form.watch("subAccountLogo");
  const watchName = form.watch("name");
  const watchEmail = form.watch("companyEmail");
  const formValues = form.watch();
  const formErrors = form.formState.errors;
  const isSubmitting = form.formState.isSubmitting;

  // Calculate form completion progress
  useEffect(() => {
    const requiredFields = ['name', 'companyEmail', 'address', 'city', 'state', 'country', 'zipCode'];
    const filledFields = requiredFields.filter(field => formValues[field as keyof typeof formValues]?.toString().trim());
    setFormProgress((filledFields.length / requiredFields.length) * 100);
  }, [formValues]);

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
    if (details) {
      form.reset(defaultValues);
    }
  }, [details, defaultValues, form]);

  // Function to check if a tab has errors
  const hasTabErrors = (tabName: string) => {
    if (tabName === "basic") return !!(formErrors.name || formErrors.companyEmail || formErrors.companyPhone);
    if (tabName === "branding") return !!formErrors.subAccountLogo;
    if (tabName === "address") return !!(formErrors.address || formErrors.city || formErrors.state || formErrors.zipCode || formErrors.country);
    return false;
  };

  async function onSubmit(values: SubAccountDetailsSchema) {
    try {
      // Check for required fields manually before submission
      const requiredFields = [
        { field: "name", label: "Account name", tab: "basic" },
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
        
        const firstMissingTab = missingFields[0]?.tab;
        if (firstMissingTab) {
          setActiveTab(firstMissingTab);
        }
        return;
      }

      const payload = {
        id: details?.id ?? uuidv4(),
        agencyId: agencyDetails.id,
        name: values.name.trim(),
        companyEmail: values.companyEmail.trim(),
        companyPhone: values.companyPhone?.trim() || "",
        address: values.address?.trim() || "",
        city: values.city?.trim() || "",
        zipCode: values.zipCode?.trim() || "",
        state: values.state?.trim() || "",
        country: values.country?.trim() || "",
        subAccountLogo: values.subAccountLogo || "",
        connectAccountId: "",
        goal: details?.goal ?? 5000,
      };

      const response = await upsertSubAccount(payload);

      if (!response) {
        toast.error("Subaccount creation failed");
        return;
      }

      await saveActivityLogsNotification({
        agencyId: response.agencyId,
        description: `${userName} | Created/Updated subaccount | ${response.name}`,
        subAccountId: response.id,
      });

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Subaccount saved successfully!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Your subaccount is ready to use</p>
          </div>
        </div>
      );
      
      setClose();
      router.refresh();
    } catch (error) {
      console.error("SUBACCOUNT ERROR:", error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not save sub account details.</p>
          </div>
        </div>
      );
    }
  }

  // Get icon color based on field
  const getIconColor = (field: string) => {
    const colors = {
      name: "text-blue-500",
      email: "text-cyan-500",
      phone: "text-indigo-500",
      address: "text-blue-500",
      city: "text-cyan-500",
      state: "text-indigo-500",
      zip: "text-blue-500",
      country: "text-cyan-500",
      logo: "text-indigo-500",
    };
    return colors[field as keyof typeof colors] || "text-slate-400";
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Subtle background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-indigo-500/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-indigo-500/5 via-blue-500/5 to-cyan-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative p-6 max-w-3xl mx-auto">
          {/* Header with breadcrumb only */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Home className="w-4 h-4 text-blue-500" />
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-900 dark:text-white font-medium truncate max-w-[200px]">
                {agencyDetails.name}
              </span>
              <ChevronRight className="w-3 h-3" />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-medium">
                {details?.id ? "Edit" : "New"} Sub Account
              </span>
            </div>
            <Badge 
              variant="outline" 
              className="bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-indigo-500/5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 gap-1"
            >
              <Sparkles className="w-3 h-3" />
              {details?.id ? "Update Mode" : "Create Mode"}
            </Badge>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Header Card with Gradient */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600" />
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur-lg opacity-20" />
                      <Avatar className="w-20 h-20 border-2 border-white dark:border-slate-800 ring-4 ring-blue-500/20 relative">
                        <AvatarImage src={watchLogo || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-2xl">
                          {watchName?.charAt(0) || <Store className="w-8 h-8" />}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent">
                        {watchName || "New Sub Account"}
                      </h1>
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="w-4 h-4 text-cyan-600" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {watchEmail || "email@example.com"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Briefcase className="w-4 h-4 text-indigo-600" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Parent: {agencyDetails.name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Completion</div>
                    <div className="text-2xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      {Math.round(formProgress)}%
                    </div>
                    <Progress 
                      value={formProgress} 
                      className="w-32 h-1.5 mt-2 bg-slate-100 dark:bg-slate-800"
                      
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Validation Summary */}
            {Object.keys(validationErrors).length > 0 && (
              <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                  <div className="font-medium mb-1 text-red-800 dark:text-red-200">Please fix the following:</div>
                  <ul className="list-disc list-inside text-sm">
                    {Object.entries(validationErrors).map(([field, message]) => (
                      <li key={field} className="text-red-700 dark:text-red-300">
                        {field.replace(/([A-Z])/g, ' $1').toLowerCase()}: {message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Form Card */}
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600" />
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-800/50">
                  <TabsList className="h-14 bg-transparent gap-6">
                    <TabsTrigger 
                      value="branding"
                      className="relative h-14 px-0 rounded-none bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-400 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
                    >
                      <Palette className="w-4 h-4 mr-2 text-indigo-500" />
                      Branding
                      {hasTabErrors("branding") && (
                        <span className="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger 
                      value="basic"
                      className="relative h-14 px-0 rounded-none bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-400 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
                    >
                      <Building2 className="w-4 h-4 mr-2 text-blue-500" />
                      Basic Info
                      {hasTabErrors("basic") && (
                        <span className="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger 
                      value="address"
                      className="relative h-14 px-0 rounded-none bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-400 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
                    >
                      <MapPin className="w-4 h-4 mr-2 text-cyan-500" />
                      Address
                      {hasTabErrors("address") && (
                        <span className="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>

                <CardContent className="p-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      {/* Branding Tab */}
                      {activeTab === "branding" && (
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="subAccountLogo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium flex items-center gap-2">
                                  <Upload className={`w-4 h-4 ${getIconColor('logo')}`} />
                                  Account Logo
                                </FormLabel>
                                <FormControl>
                                  <div className="mt-1 p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                    <FileUpload
                                      value={field.value || ""}
                                      onChange={(url) => field.onChange(url ?? "")}
                                    />
                                  </div>
                                </FormControl>
                                <FormDescription className="text-xs text-slate-500 flex items-center gap-1">
                                  <Image className="w-3 h-3" />
                                  Square image recommended. Max size: 2MB
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {/* Basic Info Tab */}
                      {activeTab === "basic" && (
                        <div className="space-y-5">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium flex items-center gap-2">
                                  <Store className={`w-4 h-4 ${getIconColor('name')}`} />
                                  Account Name
                                  <span className="text-red-500">*</span>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <HelpCircle className="w-3 h-3 text-slate-400" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                      <p className="text-xs">Your business or project name</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., Aexon Marketing"
                                    className="h-11 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="companyEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium flex items-center gap-2">
                                  <Mail className={`w-4 h-4 ${getIconColor('email')}`} />
                                  Business Email
                                  <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="email"
                                    placeholder="hello@aexon.com"
                                    className="h-11 border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="companyPhone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium flex items-center gap-2">
                                  <Phone className={`w-4 h-4 ${getIconColor('phone')}`} />
                                  Phone Number
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="+1 (555) 123-4567"
                                    className="h-11 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription className="text-xs text-slate-500">
                                  Include country code for international numbers
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {/* Address Tab */}
                      {activeTab === "address" && (
                        <div className="space-y-5">
                          <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium flex items-center gap-2">
                                  <MapPin className={`w-4 h-4 ${getIconColor('address')}`} />
                                  Street Address
                                  <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="123 Business Ave, Suite 100"
                                    className="h-11 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm flex items-center gap-1">
                                    <MapPin className={`w-3 h-3 ${getIconColor('city')}`} />
                                    City
                                    <span className="text-red-500 ml-1">*</span>
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="San Francisco"
                                      className="h-11 border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm flex items-center gap-1">
                                    <MapPin className={`w-3 h-3 ${getIconColor('state')}`} />
                                    State
                                    <span className="text-red-500 ml-1">*</span>
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="CA"
                                      className="h-11 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
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
                                  <FormLabel className="text-sm flex items-center gap-1">
                                    <MapPin className={`w-3 h-3 ${getIconColor('zip')}`} />
                                    Zip Code
                                    <span className="text-red-500 ml-1">*</span>
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="94105"
                                      className="h-11 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="country"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm flex items-center gap-1">
                                    <Globe className={`w-3 h-3 ${getIconColor('country')}`} />
                                    Country
                                    <span className="text-red-500 ml-1">*</span>
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="United States"
                                      className="h-11 border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setClose()}
                          className="px-6 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          isLoading={isSubmitting}
                          disabled={isSubmitting}
                          className="px-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-700 hover:via-cyan-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/20"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {details?.id ? "Update Account" : "Create Account"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default SubAccountDetails;