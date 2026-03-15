import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Upload } from "lucide-react";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

import { cn, constructMetadata, formatPrice } from "@/lib/utils";

interface PaymentSuccessfullPageProps {
  searchParams: {
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  };
}

// WIP: Razorpay payment verification
const PaymentSuccessfullPage: React.FC<PaymentSuccessfullPageProps> = async ({
  searchParams,
}) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
    searchParams;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    redirect("/");
  }

  // TODO: Verify Razorpay signature
  const paymentAmount = 0;
  const paymentDate = new Date();

  // Placeholder order data for Razorpay
  const order = {
    id: razorpay_order_id,
    amount: paymentAmount,
    currency: "INR",
    receipt: razorpay_payment_id,
  };

  return (
    <div className="p-4 my-4 text-center w-screen flex justify-center items-center flex-col gap-4 max-w-2xl mx-auto">
      <div>
        <p className="text-sm font-medium text-green-600 inline-flex gap-2 items-center">
          <CheckCircle2 className="w-4 h-4" />
          Order successful
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          Thanks for ordering
        </h1>
      </div>
      <div className="w-full text-left mb-4">
        <h3 className="text-2xl font-semibold mb-2">Order</h3>
        <Separator className="mb-2" />
        <div className="space-y-6 mt-4 border-t border-border pt-6 text-sm font-medium w-full">
          <div className="flex justify-between">
            <p className="text-muted-foreground">Order ID</p>
            <p className="font-mono">{order.id}</p>
          </div>
          <div className="flex justify-between">
            <p className="text-muted-foreground">Payment ID</p>
            <p className="font-mono">{razorpay_payment_id}</p>
          </div>
          <div className="flex justify-between">
            <p className="text-muted-foreground">Date</p>
            <p>{format(paymentDate, "dd/MM/yyyy hh:mm a")}</p>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-6">
            <p className="text-base">Total</p>
            <p className="text-base">{formatPrice(order.amount / 100)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 w-full mt-4">
        <Link
          href="/"
          className={cn("inline-flex items-center gap-2", buttonVariants())}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </div>
    </div>
  );
};

export default PaymentSuccessfullPage;

export const metadata = constructMetadata({
  title: "Payment successfull - Aexon",
});
