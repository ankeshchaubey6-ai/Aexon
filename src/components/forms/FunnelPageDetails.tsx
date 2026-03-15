"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  CopyPlusIcon,
  Info,
  Loader2,
  Trash,
  Save,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Link,
  Copy,
  Layers,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { v4 as uuidv4 } from "uuid";
import { type FunnelPage } from "@prisma/client";

import { saveActivityLogsNotification } from "@/queries/notifications";
import {
  upsertFunnelPage,
  getFunnels,
  deleteFunnelPage,
} from "@/queries/funnels";

import { useModal } from "@/hooks/use-modal";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Alert, AlertDescription } from "../ui/alert";

import {
  type FunnelPageDetailsSchema,
  FunnelPageDetailsValidator,
} from "@/lib/validators/funnel-page-details";

interface FunnelPageDetailsProps {
  defaultData?: FunnelPage;
  funnelId: string;
  order: number;
  subAccountId: string;
}

const FunnelPageDetails: React.FC<FunnelPageDetailsProps> = ({
  funnelId,
  order,
  subAccountId,
  defaultData,
}) => {
  const router = useRouter();
  const { setClose } = useModal();

  const form = useForm<FunnelPageDetailsSchema>({
    resolver: zodResolver(FunnelPageDetailsValidator),
    mode: "onChange",
    defaultValues: {
      name: "",
      pathName: "",
    },
  });

  const watchName = form.watch("name");
  const watchPath = form.watch("pathName");
  const formErrors = form.formState.errors;

  React.useEffect(() => {
    if (defaultData) {
      form.reset({
        name: defaultData.name ?? "",
        pathName: defaultData.pathName ?? "",
      });
    } else {
      form.reset({
        name: "",
        pathName: "",
      });
    }
  }, [defaultData, form]);

  const onSubmit: SubmitHandler<FunnelPageDetailsSchema> = async (values) => {
    try {
      const safeName = (values?.name ?? "").toString().trim();
      const safePath = (values?.pathName ?? "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");

      if (!safeName) {
        form.setError("name", {
          type: "manual",
          message: "Page name is required",
        });
        return;
      }

      if (order !== 0 && !safePath) {
        form.setError("pathName", {
          type: "manual",
          message: "Path name is required for non-first pages",
        });
        return;
      }

      const response = await upsertFunnelPage(subAccountId, funnelId, {
        id: defaultData?.id ?? uuidv4(),
        name: safeName,
        pathName: order === 0 ? "" : safePath,
        order: defaultData?.order ?? order,
      });

      await saveActivityLogsNotification({
        agencyId: undefined,
        description: `Saved a funnel page | ${response?.name}`,
        subAccountId,
      });

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Success!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Funnel page saved successfully</p>
          </div>
        </div>
      );

      setClose();
      router.refresh();
    } catch (error: any) {
      console.error("FUNNEL SAVE ERROR:", error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not save funnel page</p>
          </div>
        </div>
      );
    }
  };

  const handleDeleteFunnelPage = async () => {
    if (!defaultData?.id) return;

    try {
      await deleteFunnelPage(defaultData.id);

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Deleted</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Funnel page deleted</p>
          </div>
        </div>
      );

      setClose();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Failed to delete</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not delete funnel page</p>
          </div>
        </div>
      );
    }
  };

  const handleCopyFunnelPage = async () => {
    if (!defaultData) return;

    try {
      const funnels = await getFunnels(subAccountId);
      const current = funnels.find((f) => f.id === funnelId);
      const lastOrder = current?.funnelPages?.length ?? 0;

      await upsertFunnelPage(subAccountId, funnelId, {
        id: uuidv4(),
        name: `${defaultData.name} Copy`,
        pathName: `${defaultData.pathName || "page"}-copy`,
        order: lastOrder,
      });

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Duplicated</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Page copied successfully</p>
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
            <p className="font-semibold">Failed to duplicate</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not duplicate funnel page</p>
          </div>
        </div>
      );
    }
  };

  const isLoading = form.formState.isSubmitting || form.formState.isLoading;

  return (
    <TooltipProvider>
      <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600" />
          
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                    {defaultData ? "Edit Funnel Page" : "Create Funnel Page"}
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                    {defaultData 
                      ? "Update your funnel page details" 
                      : "Add a new page to your funnel"}
                  </CardDescription>
                </div>
              </div>
              
              <Badge 
                variant="outline" 
                className="bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-indigo-500/5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 gap-1"
              >
                <Sparkles className="w-3 h-3" />
                {defaultData ? "Edit Mode" : "Create Mode"}
              </Badge>
            </div>

            {/* Order Badge */}
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <Layers className="w-3 h-3 mr-1" />
                Order: {order}
              </Badge>
              {order === 0 && (
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-slate-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">First page doesn't require a path</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Preview */}
            {(watchName || watchPath) && (
              <div className="mt-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-100 dark:border-blue-900">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
                    <Eye className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {watchName || "Page Name"}
                    </p>
                    {watchPath && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Link className="w-3 h-3" />
                        /{watchPath.toLowerCase().replace(/\s+/g, '-')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Error Summary */}
            {Object.keys(formErrors).length > 0 && (
              <Alert variant="destructive" className="py-2 border-red-200 dark:border-red-900">
                <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                <AlertDescription className="text-xs text-red-700 dark:text-red-300">
                  Please check the form for errors
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                {/* Page Name Field */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        Page Name
                        <span className="text-red-500">*</span>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">Display name for your funnel page</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Landing Page, Thank You"
                          className={`h-10 text-sm border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all ${
                            formErrors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                          }`}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        This will be displayed in the funnel navigation
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Path Name Field */}
                <FormField
                  control={form.control}
                  name="pathName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                        <Link className="w-3.5 h-3.5 text-cyan-600" />
                        Path Name
                        {order !== 0 && <span className="text-red-500">*</span>}
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">URL path for this page (e.g., about, contact)</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">/</span>
                          <Input
                            placeholder={order === 0 ? "First page (no path)" : "page-path"}
                            className={`pl-7 h-10 text-sm border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all ${
                              formErrors.pathName ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                            }`}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            disabled={order === 0}
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        {order === 0 
                          ? "First page doesn't require a path" 
                          : "This will be the URL path for this page"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator className="my-4" />

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setClose()}
                    size="sm"
                    className="h-9 px-4 text-xs border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </Button>

                  <div className="flex items-center gap-2">
                    {defaultData?.id && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 w-9 p-0"
                              onClick={handleCopyFunnelPage}
                              disabled={isLoading}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicate page</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-9 w-9 p-0 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white border-0"
                              onClick={handleDeleteFunnelPage}
                              disabled={isLoading}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete page</TooltipContent>
                        </Tooltip>
                      </>
                    )}

                    <Button
                      type="submit"
                      disabled={isLoading}
                      size="sm"
                      className="h-9 px-4 text-xs bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-700 hover:via-cyan-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/20 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                          Save Page
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>

            {/* Quick Tip */}
            <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700">
              <p className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span className="font-medium text-slate-600 dark:text-slate-300">Tip:</span>
                <span>Pages are displayed in order. First page is your landing page.</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default FunnelPageDetails;