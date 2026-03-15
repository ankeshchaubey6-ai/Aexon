export const BILLING_ENABLED =
  process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

export const BILLING_PROVIDER = BILLING_ENABLED ? "stripe" : "mock";