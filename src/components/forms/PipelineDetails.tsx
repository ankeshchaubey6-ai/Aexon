"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { SubmitHandler, useForm } from "react-hook-form";
import {
  Layers,
  Save,
  Trash2,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  GitBranch,
} from "lucide-react";

import { deletePipeline, upsertPipeline } from "@/queries/pipelines";
import { saveActivityLogsNotification } from "@/queries/notifications";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Pipeline } from "@prisma/client";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Alert, AlertDescription } from "../ui/alert";

import {
  CreatePipelineValidator,
  type CreatePipelineSchema,
} from "@/lib/validators/create-pipeline";

interface PipelineDetailsProps {
  defaultData?: Pipeline;
  subAccountId: string;
  pipelineId: string;
}

const PipelineDetails: React.FC<PipelineDetailsProps> = ({
  defaultData,
  subAccountId,
  pipelineId,
}) => {
  const { setClose } = useModal();
  const router = useRouter();

  const form = useForm<CreatePipelineSchema>({
    mode: "onChange",
    resolver: zodResolver(CreatePipelineValidator),
    defaultValues: {
      name: defaultData?.name ?? "",
    },
  });

  const watchName = form.watch("name");
  const formErrors = form.formState.errors;

  React.useEffect(() => {
    if (defaultData) {
      form.reset({
        name: defaultData.name ?? "",
      });
    }
  }, [defaultData, form]);

  const isSubmitting = form.formState.isSubmitting;

  const handleDelete = async () => {
    try {
      if (!pipelineId) {
        toast.error("Pipeline ID missing");
        return;
      }

      const response = await deletePipeline(pipelineId);

      await saveActivityLogsNotification({
        agencyId: undefined,
        description: `Deleted pipeline | ${response?.name}`,
        subAccountId,
      });

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Pipeline deleted</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{response?.name} has been removed</p>
          </div>
        </div>
      );
      
      setClose();
      router.push(`/subaccount/${subAccountId}/pipelines`);
      router.refresh();
    } catch (error: any) {
      console.error("Delete Pipeline Error:", error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not delete pipeline</p>
          </div>
        </div>
      );
    }
  };

  const onSubmit: SubmitHandler<CreatePipelineSchema> = async (values) => {
    if (!subAccountId) {
      toast.error("SubAccount ID missing");
      return;
    }

    if (!values.name || values.name.trim().length === 0) {
      toast.error("Pipeline name is required");
      return;
    }

    try {
      const response = await upsertPipeline({
        id: defaultData?.id,
        name: values.name.trim(),
        subAccountId: subAccountId,
      });

      if (!response) {
        toast.error("Failed to save pipeline");
        return;
      }

      await saveActivityLogsNotification({
        agencyId: undefined,
        description: `Saved pipeline | ${response.name}`,
        subAccountId,
      });

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Pipeline saved successfully!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{response.name} has been {defaultData ? "updated" : "created"}</p>
          </div>
        </div>
      );

      setClose();
      router.refresh();
    } catch (error: any) {
      console.error("Pipeline Save Error:", error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not save pipeline</p>
          </div>
        </div>
      );
    }
  };

  return (
    <TooltipProvider>
      <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600" />
          
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
                  <Layers className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                    {defaultData ? "Edit Pipeline" : "Create Pipeline"}
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                    {defaultData 
                      ? "Update your pipeline details" 
                      : "Create a new pipeline for your workflow"}
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

            {/* Preview */}
            {watchName && (
              <div className="mt-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-100 dark:border-blue-900">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
                    <GitBranch className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {watchName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pipeline preview
                    </p>
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
                {/* Name Field */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        Pipeline Name
                        <span className="text-red-500">*</span>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">Name for your pipeline (e.g., Sales, Support)</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Sales Pipeline, Customer Support"
                          className={`h-10 text-sm border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all ${
                            formErrors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                          }`}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        Give your pipeline a descriptive name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator className="my-4" />

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2">
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
                    {defaultData && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-9 px-4 text-xs bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white border-0 shadow-lg shadow-rose-600/20"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>

                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-xl">
                              <div className="p-2 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500">
                                <AlertTriangle className="w-5 h-5 text-white" />
                              </div>
                              Delete Pipeline
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-base pt-4">
                              Are you sure you want to delete <span className="font-semibold text-rose-600 dark:text-rose-400">"{defaultData?.name}"</span>?
                            </AlertDialogDescription>
                          </AlertDialogHeader>

                          <div className="py-4">
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                              <p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>
                                  This will permanently delete all lanes and tickets in this pipeline. 
                                  This action cannot be undone.
                                </span>
                              </p>
                            </div>
                          </div>

                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-slate-200 dark:border-slate-700">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDelete}
                              className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white border-0"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Yes, Delete Pipeline
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      isLoading={isSubmitting}
                      size="sm"
                      className="h-9 px-4 text-xs bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-700 hover:via-cyan-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/20 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      {isSubmitting ? "Saving..." : defaultData ? "Update Pipeline" : "Create Pipeline"}
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
                <span>Pipelines help organize your workflow. Add lanes for each stage.</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default PipelineDetails;