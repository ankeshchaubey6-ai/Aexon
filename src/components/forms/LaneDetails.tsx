"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Lane } from "@prisma/client";
import {
  Layers,
  Palette,
  Save,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Paintbrush,
} from "lucide-react";

import { getPipelineDetails } from "@/queries/pipelines";
import { upsertLane } from "@/queries/lanes";
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
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Alert, AlertDescription } from "../ui/alert";
import { ColorPicker } from "../ui/color-picker";

import {
  type LaneDetailsSchema,
  LaneDetailsValidator,
} from "@/lib/validators/lane-details";

interface LaneDetailsProps {
  defaultData?: Lane;
  pipelineId: string;
}

const LaneDetails: React.FC<LaneDetailsProps> = ({
  defaultData,
  pipelineId,
}) => {
  const router = useRouter();
  const { setClose } = useModal();

  const form = useForm<LaneDetailsSchema>({
    mode: "onChange",
    resolver: zodResolver(LaneDetailsValidator),
    defaultValues: {
      name: defaultData?.name ?? "",
      color:
        defaultData?.color ??
        "linear-gradient(to bottom right,#3b82f6,#06b6d4,#4f46e5)",
    },
  });

  const watchName = form.watch("name");
  const watchColor = form.watch("color");
  const formErrors = form.formState.errors;

  React.useEffect(() => {
    if (defaultData) {
      form.reset({
        name: defaultData.name ?? "",
        color: defaultData.color ?? "",
      });
    }
  }, [defaultData, form]);

  const onSubmit: SubmitHandler<LaneDetailsSchema> = async (values) => {
    if (!pipelineId) {
      toast.error("Pipeline ID missing");
      return;
    }

    try {
      if (!values.name || values.name.trim().length === 0) {
        toast.error("Lane name is required");
        return;
      }

      const response = await upsertLane({
        id: defaultData?.id,
        name: values.name.trim(),
        color: values.color,
        pipelineId: pipelineId,
        order: defaultData?.order,
      });

      if (!response) {
        toast.error("Failed to create lane");
        return;
      }

      const pipelineDetails = await getPipelineDetails(pipelineId);

      if (pipelineDetails?.subAccountId) {
        await saveActivityLogsNotification({
          agencyId: undefined,
          description: `Created/Updated a lane | ${response.name}`,
          subAccountId: pipelineDetails.subAccountId,
        });
      }

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Lane saved successfully!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{response.name} has been {defaultData ? "updated" : "created"}</p>
          </div>
        </div>
      );

      setClose();
      router.refresh();
    } catch (error: any) {
      console.error("Lane Save Error:", error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not save lane</p>
          </div>
        </div>
      );
    }
  };

  const isLoading = form.formState.isSubmitting;

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
                    {defaultData ? "Edit Lane" : "Create Lane"}
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                    {defaultData 
                      ? "Update lane details and color" 
                      : "Add a new lane to your pipeline"}
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

            {/* Preview Card */}
            {(watchName || watchColor) && (
              <div 
                className="mt-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700"
                style={{ 
                  background: watchColor || 'linear-gradient(to bottom right, #3b82f6, #06b6d4, #4f46e5)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium drop-shadow-md">
                      {watchName || "Lane Name"}
                    </p>
                    <p className="text-xs text-white/80 drop-shadow-md">
                      Pipeline lane preview
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
                        Lane Name
                        <span className="text-red-500">*</span>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">Name for this pipeline stage</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Leads, In Progress, Closed"
                          className={`h-10 text-sm border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all ${
                            formErrors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                          }`}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        Give your lane a descriptive name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Color Field */}
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-cyan-600" />
                        Lane Color
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">Choose a color to identify this lane</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <ColorPicker
                            value={field.value}
                            onChange={field.onChange}
                          />
                          
                          {/* Selected Color Preview */}
                          <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <Paintbrush className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs text-slate-600 dark:text-slate-400">Selected color:</span>
                            <div 
                              className="w-6 h-6 rounded-full"
                              style={{ background: field.value }}
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        This color will appear on the lane header
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
                  <Button
                    type="submit"
                    disabled={isLoading}
                    isLoading={isLoading}
                    size="sm"
                    className="h-9 px-4 text-xs bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-700 hover:via-cyan-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/20 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {isLoading ? "Saving..." : defaultData ? "Update Lane" : "Create Lane"}
                  </Button>
                </div>
              </form>
            </Form>

            {/* Quick Tip */}
            <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700">
              <p className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span className="font-medium text-slate-600 dark:text-slate-300">Tip:</span>
                <span>Lanes help organize your pipeline stages. Drag to reorder.</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default LaneDetails;