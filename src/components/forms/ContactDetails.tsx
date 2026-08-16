"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  User,
  Mail,
  Save,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserPlus,
  Contact,
} from "lucide-react";

import { saveActivityLogsNotification } from "@/queries/notifications";
import { upsertContact } from "@/queries/contacts";

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

import {
  type ContactDetailsSchema,
  ContactDetailsValidator,
} from "@/lib/validators/contact-details";

interface ContactDetailsProps {
  subAccountId: string;
}

const ContactDetails: React.FC<ContactDetailsProps> = ({ subAccountId }) => {
  const router = useRouter();
  const { setClose, data } = useModal();

  const form = useForm<ContactDetailsSchema>({
    resolver: zodResolver(ContactDetailsValidator),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
    },
  });

  const watchName = form.watch("name");
  const watchEmail = form.watch("email");
  const formErrors = form.formState.errors;

  // 🔥 SAFE RESET
  React.useEffect(() => {
    if (data?.contact) {
      form.reset({
        name: data.contact.name ?? "",
        email: data.contact.email ?? "",
      });
    }
  }, [data, form]);

  const onSubmit: SubmitHandler<ContactDetailsSchema> = async (values) => {
    if (!subAccountId) {
      toast.error("SubAccount ID missing");
      return;
    }

    try {
      const safeName = (values?.name ?? "").toString().trim();
      const safeEmail = (values?.email ?? "").toString().trim();

      if (!safeName || !safeEmail) {
        toast.error("Name and Email are required");
        return;
      }

      const payload = {
        id: data?.contact?.id,
        name: safeName,
        email: safeEmail,
        subAccountId,
      };

      const response = await upsertContact(payload);

      if (!response) {
        toast.error("Failed to save contact");
        return;
      }

      await saveActivityLogsNotification({
        agencyId: undefined,
        description: `Saved contact | ${response.name}`,
        subAccountId,
      });

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Contact saved successfully!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{response.name} has been added</p>
          </div>
        </div>
      );

      setClose();
      router.refresh();
    } catch (error) {
      console.error("Contact save error:", error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not save contact details</p>
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
                  <Contact className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                    {data?.contact?.id ? "Edit Contact" : "Create Contact"}
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                    {data?.contact?.id 
                      ? "Update contact information" 
                      : "Add a new contact to your pipeline"}
                  </CardDescription>
                </div>
              </div>
              
              <Badge 
                variant="outline" 
                className="bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-indigo-500/5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 gap-1"
              >
                <Sparkles className="w-3 h-3" />
                {data?.contact?.id ? "Edit Mode" : "Create Mode"}
              </Badge>
            </div>

            {/* Preview */}
            {(watchName || watchEmail) && (
              <div className="mt-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-100 dark:border-blue-900">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                    {watchName ? watchName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {watchName || "Contact Name"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {watchEmail || "email@example.com"}
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
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        Name
                        <span className="text-red-500">*</span>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">Contact&apos;s full name</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., John Doe"
                          className={`h-10 text-sm border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all ${
                            formErrors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                          }`}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        Enter the contact&apos;s full name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email Field */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-cyan-600" />
                        Email
                        <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          className={`h-10 text-sm border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all ${
                            formErrors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                          }`}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        Contact&apos;s email address for notifications
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
                    {isLoading ? "Saving..." : data?.contact?.id ? "Update Contact" : "Save Contact"}
                  </Button>
                </div>
              </form>
            </Form>

            {/* Quick Tip */}
            <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700">
              <p className="flex items-center gap-1">
                <UserPlus className="w-3 h-3" />
                <span className="font-medium text-slate-600 dark:text-slate-300">Tip:</span>
                <span>Contacts can be linked to tickets and pipelines</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default ContactDetails;
