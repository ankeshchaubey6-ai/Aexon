import Razorpay from "razorpay";

/** Construct the SDK only inside a request, never while Next.js imports routes. */
export const isRazorpayConfigured = Boolean(
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
);

export function getRazorpay(): Razorpay | null {
  if (!isRazorpayConfigured) return null;

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}
