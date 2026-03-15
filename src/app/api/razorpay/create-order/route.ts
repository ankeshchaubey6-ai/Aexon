import { NextRequest, NextResponse } from "next/server";
import { razorpay } from "@/lib/razorpay";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, funnelId, subAccountId } = body as {
      amount: number; // MUST be in paise from frontend
      funnelId: string;
      subAccountId: string;
    };

    // Validate inputs
    if (!amount || !funnelId || !subAccountId) {
      return NextResponse.json(
        { error: "Missing required fields: amount, funnelId, subAccountId" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Fetch subaccount + agency (needed for revenue split)
    const subAccount = await db.subAccount.findUnique({
      where: { id: subAccountId },
      include: { agency: true },
    });

    if (!subAccount || !subAccount.agencyId) {
      return NextResponse.json(
        { error: "Invalid subaccount or agency not found" },
        { status: 404 }
      );
    }

    const agencyId = subAccount.agencyId;

    /**
     * IMPORTANT:
     * Frontend EditorPayment already sends price in PAISE
     * DO NOT multiply by 100 again (will cause 100x charge)
     */
    const amountInPaise = Math.floor(Number(amount));

    // Platform fee logic (1% SaaS fee)
    const platformFee = Math.floor(amountInPaise * 0.01);
    const agencyEarnings = amountInPaise - platformFee;

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `funnel_${funnelId}_${Date.now()}`,
      notes: {
        funnelId,
        subAccountId,
        agencyId,
        type: "funnel_payment",
      },
    });

    // Store payment in DB (for analytics + wallet + revenue dashboard)
    await db.payment.create({
      data: {
        razorpayOrderId: order.id,
        amount: amountInPaise,
        currency: "INR",
        platformFee,
        agencyEarnings,
        funnelId,
        subAccountId,
        agencyId,
        status: "created",
      },
    });

    return NextResponse.json({
      id: order.id,
      amount: amountInPaise,
      currency: "INR",
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error("RAZORPAY_CREATE_ORDER_ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create Razorpay order" },
      { status: 500 }
    );
  }
}