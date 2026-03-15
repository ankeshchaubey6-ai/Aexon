"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Image,
  Save,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

import { createMedia } from "@/queries/media";
import { saveActivityLogsNotification } from "@/queries/notifications";

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
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Alert, AlertDescription } from "../ui/alert";
import FileUpload from "../common/FileUpload";

import {
  UploadMediaValidator,
  type UploadMediaSchema,
} from "@/lib/validators/upload-media";

interface UploadMediaFormProps {
  subAccountId: string;
}

const UploadMediaForm: React.FC<UploadMediaFormProps> = ({ subAccountId }) => {
  const router = useRouter();
  const { setClose } = useModal();

  const form = useForm<UploadMediaSchema>({
    resolver: zodResolver(UploadMediaValidator),
    mode: "onChange",
    defaultValues: {
      link: "",
      name: "",
    },
  });

  const watchLink = form.watch("link");
  const watchName = form.watch("name");
  const formErrors = form.formState.errors;
  const isSubmitting = form.formState.isSubmitting;

  const onSubmit: SubmitHandler<UploadMediaSchema> = async (values) => {
    console.log("[UploadMediaForm] SUBMIT VALUES:", values);

    if (!subAccountId) {
      toast.error("Error", {
        description: "SubAccount ID is missing",
      });
      return;
    }

    if (!values.name || values.name.trim() === "") {
      toast.error("Error", {
        description: "File name is required",
      });
      return;
    }

    if (!values.link || values.link.trim() === "") {
      toast.error("Error", {
        description: "Please upload a file first",
      });
      return;
    }

    try {
      const payload = {
        name: values.name.trim(),
        link: values.link.trim(),
      };

      const response = await createMedia(subAccountId, payload);

      if (!response) {
        throw new Error("Media creation failed");
      }

      await saveActivityLogsNotification({
        agencyId: undefined,
        description: `Uploaded a media file | ${response.name}`,
        subAccountId,
      });

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Upload successful!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{response.name} has been uploaded</p>
          </div>
        </div>
      );

      setClose();
      router.refresh();
    } catch (error) {
      console.error("[UploadMediaForm] ERROR:", error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Upload failed</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not upload media file</p>
          </div>
        </div>
      );
    }
  };

  return (
    <TooltipProvider>
      <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen flex items-center justify-center p-4">
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl overflow-hidden w-full max-w-lg">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600" />
          
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
                  <Upload className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                    Upload Media
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                    Add files to your media library
                  </CardDescription>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className="bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-indigo-500/5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Media Library
              </Badge>
            </div>

            {/* Preview when file is selected */}
            {watchLink && (
              <div className="mt-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-100 dark:border-blue-900">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
                    <Image className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {watchName || "Unnamed file"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {watchLink}
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* File Name Field */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        File Name
                        <span className="text-red-500">*</span>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">Give your file a descriptive name</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Company Logo, Product Image"
                          disabled={isSubmitting}
                          className={`h-11 text-sm border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                            formErrors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                          }`}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        Choose a name that's easy to remember
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* File Upload Field */}
                <FormField
                  control={form.control}
                  name="link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        Media File
                        <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div className={`mt-1 p-6 border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-800/50 transition-all ${
                          formErrors.link 
                            ? "border-red-300 dark:border-red-800" 
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700"
                        }`}>
                          <FileUpload
                            value={field.value || ""}
                            onChange={(url: string) => {
                              console.log("[FileUpload] URL RECEIVED:", url);
                              field.onChange(url);
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        Supported: Images, Videos, Documents (max 50MB)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator className="my-4" />

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setClose()}
                    size="default"
                    className="h-11 px-6 text-sm border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    disabled={isSubmitting || !watchLink || !watchName}
                    size="default"
                    className="h-11 px-6 text-sm bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-700 hover:via-cyan-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/20 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Upload Media
                  </Button>
                </div>
              </form>
            </Form>

            {/* Quick Tip */}
            <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <p className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-medium text-slate-600 dark:text-slate-300">Tip:</span>
                <span>Use descriptive names to find files easily later</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default UploadMediaForm;