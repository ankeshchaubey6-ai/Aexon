"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pipeline } from "@prisma/client";
import {
  Settings,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronRight,
  Home,
  Layers,
  AlertTriangle,
} from "lucide-react";

import { deletePipeline } from "@/queries/pipelines";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import PipelineDetails from "@/components/forms/PipelineDetails";

interface PipelineSettingsProps {
  pipelineId: string;
  subaccountId: string;
  pipelines: Pipeline[];
}

const PipelineSettings = ({
  pipelineId,
  subaccountId,
  pipelines,
}: PipelineSettingsProps) => {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const currentPipeline = pipelines.find((p) => p.id === pipelineId);
  const totalPipelines = pipelines.length;

  const handleDeletePipeline = async () => {
    if (!pipelineId) return;
    
    setIsDeleting(true);
    try {
      const response = await deletePipeline(pipelineId);
      
      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Pipeline deleted</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The pipeline has been removed successfully
            </p>
          </div>
        </div>
      );
      
      router.push(`/subaccount/${subaccountId}/pipelines`);
      router.refresh();
    } catch (error) {
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Could not delete the pipeline
            </p>
          </div>
        </div>
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
            <Home className="w-4 h-4" />
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-900 dark:text-white font-medium">Pipelines</span>
            <ChevronRight className="w-3 h-3" />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-medium">
              {currentPipeline?.name || "Pipeline Settings"}
            </span>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                  Pipeline Settings
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Configure and manage your pipeline
                </p>
              </div>
            </div>
            <Badge 
              variant="outline" 
              className="bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-indigo-500/5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 gap-1"
            >
              <Layers className="w-3.5 h-3.5" />
              {totalPipelines} {totalPipelines === 1 ? 'Pipeline' : 'Pipelines'}
            </Badge>
          </div>

          {/* Pipeline Details Form */}
          <div className="space-y-6">
            <PipelineDetails
              subAccountId={subaccountId}
              pipelineId={pipelineId}
              defaultData={currentPipeline}
            />

            {/* Danger Zone */}
            <AlertDialog>
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
                
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 shadow-md">
                      <AlertTriangle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                        Danger Zone
                      </CardTitle>
                      <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                        Irreversible actions that will affect your pipeline
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-900">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5" />
                        <div>
                          <h3 className="font-semibold text-rose-700 dark:text-rose-300">
                            Delete Pipeline
                          </h3>
                          <p className="text-sm text-rose-600/80 dark:text-rose-400/80 mt-1">
                            Once you delete this pipeline, all lanes and tickets within it will be permanently removed. 
                            This action cannot be undone.
                          </p>
                          
                          {/* Stats */}
                          <div className="flex items-center gap-4 mt-3">
                            <div className="text-xs">
                              <span className="text-rose-600 dark:text-rose-400 font-medium">Lanes: </span>
                              <span className="text-rose-700 dark:text-rose-300">0</span>
                            </div>
                            <div className="text-xs">
                              <span className="text-rose-600 dark:text-rose-400 font-medium">Tickets: </span>
                              <span className="text-rose-700 dark:text-rose-300">0</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white border-0 shadow-lg shadow-rose-600/20"
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Pipeline
                        </Button>
                      </AlertDialogTrigger>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Delete Confirmation Dialog */}
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-xl">
                    <div className="p-2 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500">
                      <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                    Delete Pipeline
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-base pt-4">
                    Are you sure you want to delete <span className="font-semibold text-rose-600 dark:text-rose-400">&quot;{currentPipeline?.name}&quot;</span>?
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="py-4">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                    <p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        This will permanently delete all lanes, tickets, and associated data. 
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
                    onClick={handleDeletePipeline}
                    disabled={isDeleting}
                    className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white border-0"
                  >
                    {isDeleting ? (
                      <>
                        <span className="animate-spin mr-2">⚪</span>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Yes, Delete Pipeline
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Tips Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                      Pipeline Tips
                    </h4>
                    <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                      <li>Lanes represent different stages in your workflow</li>
                      <li>Drag and drop lanes to reorder them</li>
                      <li>Tickets can be moved between lanes</li>
                      <li>Each pipeline can have multiple lanes</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default PipelineSettings;
