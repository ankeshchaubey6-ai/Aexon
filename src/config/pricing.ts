export interface PricingItem {
  title: string;
  description: string;
  price: string;
  duration: string;
  highlight: string;
  features: string[];
  priceId: string;
}

export const PRICING: PricingItem[] = [
  {
    title: "Starter",
    description: "Free plan with full access (temporary unlock)",
    price: "Free",
    duration: "",
    highlight: "All Features Unlocked",
    features: [
      "Unlimited Funnels",
      "Unlimited Pipelines",
      "Unlimited Media",
      "Unlimited Contacts",
      "Unlimited Automations",
      "Full Platform Access",
    ],
    priceId: "FREE_PLAN",
  },
  {
    title: "Pro (Future)",
    description: "Future paid plan (Razorpay)",
    price: "₹999",
    duration: "month",
    highlight: "Future Upgrade",
    features: [
      "Advanced Analytics",
      "Priority Support",
      "Advanced Automations",
    ],
    priceId: "RAZORPAY_PRO",
  },
];