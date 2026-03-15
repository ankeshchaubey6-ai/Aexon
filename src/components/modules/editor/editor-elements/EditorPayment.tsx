"use client";

import React from "react";
import { useEditor } from "@/hooks/use-editor";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EditorElement } from "@/lib/types/editor";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Product {
  id: string;
  name: string;
  price: number; // STORED IN RUPEES (UI friendly)
}

interface EditorPaymentProps {
  element: EditorElement;
}

const EditorPayment: React.FC<EditorPaymentProps> = ({ element }) => {
  const { editor, dispatch, funnelId, subAccountId } = useEditor();
  const { editor: editorState } = editor;

  const [livePrices, setLivePrices] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(false);

  const isLiveMode = editorState.liveMode;

  React.useEffect(() => {
    const fetchProducts = async () => {
      if (!funnelId) return;

      try {
        const res = await fetch(
          `/api/funnels/products?funnelId=${funnelId}`
        );
        if (!res.ok) return;

        const data = await res.json();
        setLivePrices(data || []);
      } catch (error) {
        console.error("Failed to fetch funnel products", error);
      }
    };

    fetchProducts();
  }, [funnelId]);

  const loadRazorpayScript = () =>
    new Promise<boolean>((resolve) => {
      if (document.getElementById("razorpay-script")) {
        return resolve(true);
      }

      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handlePayment = async (priceInRupees: number) => {
    if (!isLiveMode || !funnelId || !subAccountId) return;

    setLoading(true);

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      alert("Razorpay SDK failed to load");
      setLoading(false);
      return;
    }

    // 🔴 CRITICAL: Convert RUPEES → PAISE (for Razorpay)
    const amountInPaise = Math.round(priceInRupees * 100);

    const res = await fetch("/api/razorpay/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInPaise, // Backend expects paise (NOW CORRECT)
        funnelId,
        subAccountId,
      }),
    });

    if (!res.ok) {
      alert("Failed to create order");
      setLoading(false);
      return;
    }

    const order = await res.json();

    const options = {
      key: order.key,
      amount: order.amount, // already in paise
      currency: order.currency,
      name: "Aexon Checkout",
      description: "Funnel Purchase",
      order_id: order.id, // 🔴 FIXED (you were using orderId incorrectly)
      handler: async function (response: any) {
        try {
          await fetch("/api/razorpay/verify-payment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          alert("Payment Successful 🎉");
        } catch (err) {
          console.error("Payment verification failed", err);
        }
      },
      theme: {
        color: "#2563eb",
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
    setLoading(false);
  };

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    dispatch({
      type: "CHANGE_CLICKED_ELEMENT",
      payload: { elementDetails: element },
    });
  };

  return (
    <div
      style={element.styles}
      onClick={handleClick}
      className={cn(
        "p-2 w-full relative flex flex-col gap-3 justify-center items-center border-dashed border"
      )}
    >
      {editorState.selectedElement.id === element.id && !isLiveMode && (
        <Badge className="absolute -top-6 left-0">
          Payment Element (Dynamic)
        </Badge>
      )}

      {livePrices.length > 0 ? (
        livePrices.map((product) => (
          <button
            key={product.id}
            disabled={loading}
            onClick={() => handlePayment(product.price)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md w-full hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : `Buy ${product.name} - ₹${product.price}`}
          </button>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">
          No products configured in funnel
        </p>
      )}
    </div>
  );
};

export default EditorPayment;