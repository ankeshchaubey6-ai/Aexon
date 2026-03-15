"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crown, Sparkles, CheckCircle2, Zap, Rocket, Gem, ArrowRight, AlertCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  customerId: string;
  isPlanExists: boolean;
}

export default function SubscriptionFormWrapper({
  customerId,
  isPlanExists,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState<"free" | "pro" | "enterprise">(
    isPlanExists ? "free" : "free"
  );

  const plans = [
    {
      id: "free",
      name: "Starter",
      price: "₹0",
      period: "",
      description: "Perfect for getting started",
      features: [
        "Full Unlock Mode",
        "All features accessible",
        "Platform wallet integration",
        "1% transaction fee",
        "Manual payouts",
        "Up to 5 team members"
      ],
      icon: Rocket,
      color: "from-blue-500 to-cyan-500",
      badge: "Free Forever",
      priceId: "FREE_PLAN"
    },
    {
      id: "pro",
      name: "Pro",
      price: "₹499",
      period: "/month",
      description: "For growing agencies",
      features: [
        "Everything in Starter",
        "Priority support",
        "Advanced analytics",
        "Custom branding",
        "API access",
        "Unlimited team members",
        "Up to 20 subaccounts"
      ],
      icon: Crown,
      color: "from-purple-500 to-pink-500",
      badge: "Popular",
      priceId: "price_1OpACCFdfEv15JJwACWCyqW2"
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "₹999",
      period: "/month",
      description: "For large agencies",
      features: [
        "Everything in Pro",
        "Dedicated account manager",
        "Custom integrations",
        "SLA guarantee",
        "White-label solution",
        "Bulk discounts",
        "Unlimited subaccounts"
      ],
      icon: Gem,
      color: "from-amber-500 to-orange-500",
      badge: "Premium",
      priceId: "price_1OpACCFdfEv15JJw0k6lm8HC"
    }
  ];

  const activatePlan = async () => {
    try {
      setLoading(true);

      const selected = plans.find(p => p.id === selectedPlan);
      
      const response = await fetch("/api/billing/activate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: selected?.priceId,
          customerId,
          planType: selectedPlan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Activation failed");
      }

      toast.success("Plan Activated", {
        description: selectedPlan === "free" 
          ? "Free plan activated successfully. All features unlocked."
          : `${plans.find(p => p.id === selectedPlan)?.name} plan activated successfully.`,
      });

      router.refresh();
    } catch (error: any) {
      toast.error("Activation Failed", {
        description: error.message || "Could not activate plan. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert className="bg-blue-500/10 border-blue-500/20">
        <AlertCircle className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-400 text-sm">
          Platform wallet model: 1% fee on all transactions. Manual payouts processed monthly.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isSelected = selectedPlan === plan.id;
          const isFree = plan.id === "free";

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative cursor-pointer transition-all duration-300 border-2 hover:scale-105 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl",
                isSelected 
                  ? "border-[#4F46E5] shadow-lg shadow-[#4F46E5]/20" 
                  : "border-white/10 hover:border-white/20"
              )}
              onClick={() => setSelectedPlan(plan.id as any)}
            >
              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center z-10">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Badge */}
              {plan.badge && (
                <Badge className={cn(
                  "absolute top-4 right-4 border-0",
                  plan.id === "pro" 
                    ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400"
                    : plan.id === "enterprise"
                    ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400"
                    : "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400"
                )}>
                  <Sparkles className="w-3 h-3 mr-1" />
                  {plan.badge}
                </Badge>
              )}

              <CardHeader>
                <div className={cn(
                  "w-12 h-12 rounded-lg bg-gradient-to-r flex items-center justify-center mb-4",
                  plan.color
                )}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-white text-xl">{plan.name}</CardTitle>
                <CardDescription className="text-white/60">
                  {plan.description}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  {plan.period && (
                    <span className="text-white/40 ml-1">{plan.period}</span>
                  )}
                </div>

                <div className="space-y-2">
                  {plan.features.slice(0, 4).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-white/70">{feature}</span>
                    </div>
                  ))}
                  {plan.features.length > 4 && (
                    <p className="text-xs text-white/40 mt-2">
                      +{plan.features.length - 4} more features
                    </p>
                  )}
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  className={cn(
                    "w-full transition-all",
                    isSelected
                      ? "bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white hover:from-[#4F46E5]/90 hover:to-[#7C3AED]/90"
                      : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlan(plan.id as any);
                  }}
                  disabled={isFree && isPlanExists}
                >
                  {isSelected ? (
                    isFree && isPlanExists ? "Current Plan" : "Selected"
                  ) : (
                    <>
                      Select Plan
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Separator className="bg-white/10" />

      <div className="flex justify-end">
        <Button
          onClick={activatePlan}
          disabled={loading || (selectedPlan === "free" && isPlanExists)}
          className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white px-8 py-6 text-base font-semibold hover:from-[#4F46E5]/90 hover:to-[#7C3AED]/90 transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Activating...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-2" />
              {selectedPlan === "free" && isPlanExists ? "Current Plan Active" : "Activate Plan"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}