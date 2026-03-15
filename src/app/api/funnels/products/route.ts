import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Product {
  id: string;
  name: string;
  price: number; // in RUPEES (UI friendly)
  currency?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const funnelId = searchParams.get("funnelId");

    if (!funnelId) {
      return NextResponse.json(
        { error: "funnelId is required" },
        { status: 400 }
      );
    }

    const funnel = await db.funnel.findUnique({
      where: {
        id: funnelId,
      },
      select: {
        liveProducts: true,
      },
    });

    if (!funnel) {
      return NextResponse.json([], { status: 200 });
    }

    // liveProducts is stored as JSON string in DB
    if (!funnel.liveProducts) {
      return NextResponse.json([], { status: 200 });
    }

    let parsedProducts: Product[] = [];

    try {
      const raw = JSON.parse(funnel.liveProducts);

      // Safety validation (prevents editor crash if JSON is malformed)
      if (Array.isArray(raw)) {
        parsedProducts = raw
          .filter((p) => p && typeof p === "object")
          .map((p: any, index: number) => ({
            id: p.id ?? `product_${index}`,
            name: p.name ?? "Product",
            price: Number(p.price) || 0, // RUPEES (important for UI)
            currency: p.currency ?? "INR",
          }))
          .filter((p) => p.price > 0);
      }
    } catch (error) {
      console.error("Invalid liveProducts JSON:", error);
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(parsedProducts, { status: 200 });
  } catch (error) {
    console.error("FUNNEL_PRODUCTS_API_ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch funnel products" },
      { status: 500 }
    );
  }
}