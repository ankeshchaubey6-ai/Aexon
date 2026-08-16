import { NextResponse } from "next/server";
import { getRazorpay } from "@/lib/razorpay";

export async function POST(req: Request) {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) {
      return NextResponse.json(
        {
          error: "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable payments.",
          code: "RAZORPAY_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const customer = await razorpay.customers.create({
      name: body.name,
      email: body.email,
      contact: body?.shipping?.phone || "9999999999",
    });

    return NextResponse.json({ customerId: customer.id });
  } catch (error) {
    console.error("RAZORPAY CUSTOMER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create Razorpay customer" },
      { status: 500 }
    );
  }
}
