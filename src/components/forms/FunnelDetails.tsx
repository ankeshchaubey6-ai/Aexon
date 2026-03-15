"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { v4 } from "uuid";
import { type Funnel } from "@prisma/client";
import {
  Filter,
  FileText,
  Globe,
  Image,
  Save,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layers,
  Link,
  Upload,
  Eye,
  Info,
  Zap,
} from "lucide-react";

import { saveActivityLogsNotification } from "@/queries/notifications";
import { upsertFunnel } from "@/queries/funnels";

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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Alert, AlertDescription } from "../ui/alert";
import FileUpload from "../common/FileUpload";

import {
  type FunnelDetailsSchema,
  FunnelDetailsValidator,
} from "@/lib/validators/funnel-details";

interface FunnelDetailsProps {
  defaultData?: Funnel;
  subAccountId: string;
}

const FunnelDetails: React.FC<FunnelDetailsProps> = ({
  defaultData,
  subAccountId,
}) => {
  const router = useRouter();
  const { setClose } = useModal();
  const [submitAttempted, setSubmitAttempted] = React.useState(false);

  const form = useForm<FunnelDetailsSchema>({
    mode: "onChange",
    resolver: zodResolver(FunnelDetailsValidator),
    defaultValues: {
      name: defaultData?.name ?? "",
      description: defaultData?.description ?? "",
      favicon: defaultData?.favicon ?? "",
      subDomainName: defaultData?.subDomainName ?? "",
    },
  });

  const watchName = form.watch("name");
  const watchDescription = form.watch("description");
  const watchSubDomain = form.watch("subDomainName");
  const watchFavicon = form.watch("favicon");
  const formErrors = form.formState.errors;

  React.useEffect(() => {
    if (defaultData) {
      form.reset({
        name: defaultData.name ?? "",
        description: defaultData.description ?? "",
        favicon: defaultData.favicon ?? "",
        subDomainName: defaultData.subDomainName ?? "",
      });
    }
  }, [defaultData, form]);

  const onSubmit = async (values: FunnelDetailsSchema) => {
    setSubmitAttempted(true);
    
    if (!subAccountId) {
      toast.error("SubAccount ID missing");
      return;
    }

    if (!values.name || values.name.trim() === "") {
      toast.error("Funnel name is required");
      return;
    }

    try {
      const funnelId = defaultData?.id || v4();

      const response = await upsertFunnel(
        subAccountId,
        {
          name: values.name.trim(),
          description: values.description ?? "",
          subDomainName: values.subDomainName ?? "",
          favicon: values.favicon ?? "",
          liveProducts: defaultData?.liveProducts ?? "[]",
        },
        funnelId
      );

      if (!response) {
        toast.error("Failed to save funnel");
        return;
      }

      await saveActivityLogsNotification({
        agencyId: undefined,
        description: `Updated funnel | ${response.name}`,
        subAccountId,
      });

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Funnel saved successfully!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {response.name} has been {defaultData ? "updated" : "created"}
            </p>
          </div>
        </div>
      );

      setClose();
      router.refresh();
    } catch (error) {
      console.error("[FunnelDetails] SAVE ERROR:", error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not save funnel details</p>
          </div>
        </div>
      );
    }
  };

  const isLoading = form.formState.isSubmitting;

  // Check if any preview data exists
  const hasPreviewData = watchName || watchSubDomain || watchFavicon;

  // Handle form submission attempt
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    form.handleSubmit(onSubmit)(e);
  };

  return (
    <TooltipProvider>
      <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="border-0 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600" />
            
            <CardHeader className="pb-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg">
                    <Filter className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent">
                      {defaultData ? "Edit Funnel" : "Create Funnel"}
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {defaultData 
                        ? "Update your funnel configuration" 
                        : "Set up a new marketing funnel"}
                    </CardDescription>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className="px-4 py-2 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-indigo-500/5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {defaultData ? "Edit Mode" : "Create Mode"}
                </Badge>
              </div>

              {/* Preview Card */}
              <div 
                className={`mt-6 transition-all duration-300 ${
                  hasPreviewData 
                    ? "opacity-100 translate-y-0" 
                    : "opacity-0 translate-y-2 pointer-events-none absolute"
                }`}
              >
                <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-100 dark:border-blue-900">
                  <div className="flex items-center gap-4">
                    {/* Favicon Preview */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-20" />
                      <div className="relative w-14 h-14 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-800 shadow-lg">
                        {watchFavicon ? (
                          <img 
                            src={watchFavicon} 
                            alt="Favicon" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Eye className="w-6 h-6 text-white" />
                        )}
                      </div>
                    </div>

                    {/* Funnel Info */}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {watchName || "Funnel Name"}
                      </h3>
                      {watchSubDomain && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-1">
                          <Globe className="w-4 h-4" />
                          {watchSubDomain}.yourdomain.com
                        </p>
                      )}
                      {watchDescription && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                          {watchDescription}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-8">
              {/* Error Summary - Only show after submit attempt */}
              {submitAttempted && Object.keys(formErrors).length > 0 && (
                <Alert variant="destructive" className="border-2 border-red-200 dark:border-red-900">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-sm text-red-700 dark:text-red-300">
                    Please fix the following errors before continuing
                  </AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form onSubmit={handleFormSubmit} className="space-y-6">
                  {/* Funnel Name Field */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-600" />
                          Funnel Name
                          <span className="text-red-500">*</span>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="w-4 h-4 text-slate-400" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p className="text-sm">Name for your marketing funnel</p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Sales Funnel, Lead Generation"
                            className={`h-12 text-base border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${
                              submitAttempted && formErrors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                            }`}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-sm text-slate-500">
                          Give your funnel a descriptive name
                        </FormDescription>
                        {submitAttempted && <FormMessage />}
                      </FormItem>
                    )}
                  />

                  {/* Description Field */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold flex items-center gap-2">
                          <FileText className="w-4 h-4 text-cyan-600" />
                          Description
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your funnel's purpose and goals..."
                            className="min-h-[100px] text-base border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-sm text-slate-500">
                          Optional: Add details about this funnel
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  {/* Sub Domain Field */}
                  <FormField
                    control={form.control}
                    name="subDomainName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold flex items-center gap-2">
                          <Globe className="w-4 h-4 text-indigo-600" />
                          Sub Domain
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="funnel-name"
                              className="h-12 text-base border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 pr-28"
                              {...field}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              .yourdomain.com
                            </span>
                          </div>
                        </FormControl>
                        <FormDescription className="text-sm text-slate-500 flex items-center gap-1">
                          <Info className="w-4 h-4" />
                          Custom subdomain for your funnel (optional)
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  {/* Favicon Field */}
                  <FormField
                    control={form.control}
                    name="favicon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold flex items-center gap-2">
                          <Image className="w-4 h-4 text-blue-600" />
                          Favicon
                        </FormLabel>
                        <FormControl>
                          <div className={`mt-2 p-8 border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-800/50 transition-all ${
                            submitAttempted && formErrors.favicon 
                              ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20" 
                              : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                          }`}>
                            <FileUpload
                              value={field.value as string}
                              onChange={field.onChange}
                            />
                          </div>
                        </FormControl>
                        <FormDescription className="text-sm text-slate-500 flex items-center gap-1">
                          <Upload className="w-4 h-4" />
                          Small icon that appears in browser tabs (32x32px recommended)
                        </FormDescription>
                        {submitAttempted && <FormMessage />}
                      </FormItem>
                    )}
                  />

                  <Separator className="my-6" />

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setClose()}
                      size="lg"
                      className="h-12 px-8 text-base border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      isLoading={isLoading}
                      size="lg"
                      className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-700 hover:via-cyan-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"
                    >
                      <Save className="w-5 h-5 mr-2" />
                      {isLoading ? "Saving..." : defaultData ? "Update Funnel" : "Create Funnel"}
                    </Button>
                  </div>
                </form>
              </Form>

              {/* Pro Tips Section */}
              <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                <h4 className="text-base font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5" />
                  Pro Tips
                </h4>
                <ul className="space-y-2 text-sm text-blue-600 dark:text-blue-400">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5" />
                    <span>Use a clear, descriptive name for your funnel to easily identify it later</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5" />
                    <span>Add a custom subdomain to create a branded URL for your funnel</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5" />
                    <span>Upload a favicon to make your funnel pages more recognizable in browser tabs</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default FunnelDetails;