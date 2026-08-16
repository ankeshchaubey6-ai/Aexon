import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { useForm } from "react-hook-form";
import {
  User,
  Mail,
  Send,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

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
import {
  ContactDetailsSchema,
  ContactDetailsValidator,
} from "@/lib/validators/contact-details";

interface EditorContactFormProps {
  title: string;
  subTitle: string;
  buttonText: string;
  styles: React.CSSProperties;
  apiCall: (values: ContactDetailsSchema) => any;
}

const EditorContactForm: React.FC<EditorContactFormProps> = ({
  apiCall,
  subTitle,
  buttonText,
  styles,
  title,
}) => {
  const form = useForm<ContactDetailsSchema>({
    mode: "onChange",
    resolver: zodResolver(ContactDetailsValidator),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  const watchName = form.watch("name");
  const watchEmail = form.watch("email");
  const formErrors = form.formState.errors;
  const isLoading = form.formState.isLoading || form.formState.isSubmitting;

  // WIP: Create tags for each leads that comes from the form

  return (
    <TooltipProvider>
      <Card 
        style={styles} 
        className="border-0 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600" />
        
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                {title && (
                  <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                    {title}
                  </CardTitle>
                )}
                {subTitle && (
                  <CardDescription className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {subTitle}
                  </CardDescription>
                )}
              </div>
            </div>
            
            <Badge 
              variant="outline" 
              className="bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-indigo-500/5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Contact Form
            </Badge>
          </div>

          {/* Live Preview */}
          {(watchName || watchEmail) && (
            <div className="mt-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-100 dark:border-blue-900">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-xs">
                  {watchName ? watchName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div className="flex-1">
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
            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
                <AlertCircle className="w-4 h-4" />
                <p className="text-xs font-medium">Please check the following:</p>
              </div>
              <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-400 space-y-0.5">
                {Object.entries(formErrors).map(([field, error]) => (
                  <li key={field}>{field}: {error.message}</li>
                ))}
              </ul>
            </div>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(apiCall)}
              className="flex flex-col gap-4"
            >
              {/* Name Field */}
              <FormField
                disabled={isLoading}
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
                          <p className="text-xs">Your full name</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        className={`h-10 text-sm border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all ${
                          formErrors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                        }`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email Field */}
              <FormField
                disabled={isLoading}
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className="my-2" />

              {/* Submit Button */}
              <Button
                className="h-10 text-sm bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-700 hover:via-cyan-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/20 disabled:opacity-50"
                disabled={isLoading}
                isLoading={isLoading}
                type="submit"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {isLoading ? "Sending..." : buttonText || "Submit"}
              </Button>

              {/* Trust Message */}
              <p className="text-xs text-center text-slate-400 dark:text-slate-500 mt-2">
                We&apos;ll never share your information with third parties
              </p>
            </form>
          </Form>

          {/* Quick Tip */}
          <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700">
            <p className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span className="font-medium text-slate-600 dark:text-slate-300">Note:</span>
              <span>Your information is secure and encrypted</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default EditorContactForm;
