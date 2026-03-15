"use client";

import React from "react";
import { toast } from "sonner";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Zap,
  Crown,
  Rocket,
  Shield,
  AlertCircle,
  Loader2,
  CreditCard,
  Gift,
  Star,
  Gem,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface SubscriptionDetailsProps {
  selectedPriceId: string;
  onActivate: () => Promise<void>;
  isPlanExists: boolean;
}

const SubscriptionDetails: React.FC<SubscriptionDetailsProps> = ({
  selectedPriceId,
  onActivate,
  isPlanExists,
}) => {
  const [loading, setLoading] = React.useState(false);

  const handleActivate = async () => {
    try {
      setLoading(true);
      await onActivate();

      toast.success(
        <div className="flex items-center gap-3">
          <div className="p-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-500">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold">Free Plan Activated!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              All features are now unlocked. Enjoy premium access! 🚀
            </p>
          </div>
        </div>
      );
    } catch (error) {
      toast.error(
        <div className="flex items-center gap-3">
          <div className="p-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-500">
            <XCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold">Activation Failed</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Something went wrong. Please try again.
            </p>
          </div>
        </div>
      );
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { name: "Unlimited Projects", icon: Rocket, color: "from-blue-600 to-cyan-600" },
    { name: "Team Collaboration", icon: Crown, color: "from-cyan-600 to-indigo-600" },
    { name: "Advanced Analytics", icon: Star, color: "from-indigo-600 to-blue-600" },
    { name: "Priority Support", icon: Shield, color: "from-blue-500 to-indigo-500" },
  ];

  return (
    <TooltipProvider>
      <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl overflow-hidden">
          {/* Gradient Header */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600" />
          
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur-lg opacity-20" />
                  <div className="relative p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
                    {isPlanExists ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : (
                      <Gift className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                    {isPlanExists ? "Active Plan" : "Free Plan"}
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                    {isPlanExists 
                      ? "Your free plan is active with all features unlocked" 
                      : "Start with our free plan - no credit card required"}
                  </CardDescription>
                </div>
              </div>
              
              {/* Status Badge */}
              <Badge 
                variant="outline" 
                className={`
                  gap-1.5 px-3 py-1
                  ${isPlanExists 
                    ? "bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300" 
                    : "bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-indigo-500/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                  }
                `}
              >
                {isPlanExists ? (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Active
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Available
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Plan Details */}
            <div className="p-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Free Plan</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Perfect for getting started
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    $0
                  </span>
                  <span className="text-xs text-slate-500 ml-1">/month</span>
                </div>
              </div>

              <Separator className="my-3 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

              {/* Features List */}
              <div className="space-y-2">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div className={`p-1 rounded-full bg-gradient-to-r ${feature.color} bg-opacity-10`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-sm text-slate-600 dark:text-slate-400">{feature.name}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
                    </div>
                  );
                })}
              </div>

              {/* Additional Info */}
              <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
                <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Gem className="w-3.5 h-3.5" />
                  Full access to all premium features. No time limit.
                </p>
              </div>
            </div>

            {/* Action Section */}
            <div className="p-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600">
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white">
                    {isPlanExists ? "Plan Already Active" : "Ready to get started?"}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isPlanExists 
                      ? "You're all set! Enjoy unlimited access to all features." 
                      : "Activate your free plan now and unlock all features instantly."}
                  </p>
                </div>
              </div>

              {/* Activation Button */}
              <Button
                onClick={handleActivate}
                disabled={loading || !selectedPriceId || isPlanExists}
                className={`
                  w-full h-11 relative overflow-hidden transition-all duration-300
                  ${isPlanExists 
                    ? "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 opacity-90" 
                    : "bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-700 hover:via-cyan-700 hover:to-indigo-700"
                  }
                  text-white font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Activating...</span>
                  </div>
                ) : isPlanExists ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Plan Active (Full Access)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <span>Activate Free Plan</span>
                  </div>
                )}
              </Button>

              {/* Trust Badge */}
              {!isPlanExists && (
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <Shield className="w-3 h-3" />
                  <span>No credit card required • Cancel anytime</span>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="border-t border-slate-200 dark:border-slate-800 py-3">
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center w-full flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" />
              Need more? Contact us for enterprise plans
            </p>
          </CardFooter>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default SubscriptionDetails;