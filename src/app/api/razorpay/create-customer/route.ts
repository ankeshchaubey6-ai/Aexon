import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(req: Request) {
  try {
    // 🔥 If keys are missing, return mock customer (DEV SAFE)
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.warn("Razorpay keys not found. Using mock customerId.");
      return NextResponse.json({
        customerId: `mock_customer_${Date.now()}`,
      });
    }

    const body = await req.json();

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const customer = await razorpay.customers.create({
      name: body.name,
      email: body.email,
      contact: body?.shipping?.phone || "9999999999",
    });

    return NextResponse.json({
      customerId: customer.id,
    });
  } catch (error) {
    console.error("RAZORPAY CUSTOMER ERROR:", error);

    // 🔥 Fallback instead of breaking agency creation
    return NextResponse.json({
      customerId: `fallback_customer_${Date.now()}`,
    });
  }
}