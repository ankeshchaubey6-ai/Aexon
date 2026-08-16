// ─────────────────────────────────────────────────────────────────────────────
// ECOMMERCE THEME PRESET
// Optimised for online stores: high trust, product-first, urgency cues,
// clear pricing, conversion-focused CTAs.
// Brand: warm neutrals + high-contrast black + accent orange/red for CTAs.
//
// Usage:
//   import { ecommerceTheme } from "@/lib/component-pool/themes/ecommerce";
//   const theme = deepMerge(baseTheme, ecommerceTheme);
// ─────────────────────────────────────────────────────────────────────────────

import { ramps } from "./tokens/colors.js";
import { fontWeight } from "./tokens/typography.js";
import { borderRadius } from "./tokens/spacing.js";
import { glowShadows, shadows } from "./tokens/shadows.js";

export const ecommerceTheme = {
  name: "ecommerce",
  mode: "light",

  colors: {
    brand: {
      primary:        ramps.orange[500],
      primaryHover:   ramps.orange[600],
      primaryActive:  ramps.orange[700],
      primarySubtle:  ramps.orange[50],
      primaryMuted:   ramps.orange[100],
      secondary:      ramps.gray[900],  // Rich black — premium feel
      secondaryHover: ramps.gray[800],
      accent:         ramps.rose[500],  // Sale / urgency badges
      accentHover:    ramps.rose[600],
      cta:            ramps.orange[500],
      ctaHover:       ramps.orange[600],
    },

    section: {
      hero:        ramps.white,
      productGrid: ramps.gray[50],
      category:    ramps.gray[100],
      promo:       ramps.orange[50],
      cart:        ramps.white,
      checkout:    ramps.gray[50],
      reviews:     ramps.white,
      cta:         ramps.gray[900],     // Dark section for contrast
    },

    product: {
      // Product card states
      badgeSale:       ramps.rose[500],
      badgeSaleText:   ramps.white,
      badgeNew:        ramps.emerald[500],
      badgeNewText:    ramps.white,
      badgeBestseller: ramps.amber[500],
      badgeBestsellerText: ramps.white,
      badgeLimitedTime: ramps.orange[500],

      // Price display
      priceColor:      ramps.gray[900],
      salePriceColor:  ramps.rose[600],
      originalPrice:   ramps.gray[400],  // Strikethrough

      // Rating stars
      starFilled:      ramps.amber[400],
      starEmpty:       ramps.gray[200],

      // Stock status
      inStock:         ramps.emerald[600],
      lowStock:        ramps.amber[600],
      outOfStock:      ramps.gray[400],
    },

    cart: {
      bg:              ramps.white,
      border:          ramps.gray[200],
      total:           ramps.gray[900],
      subtotal:        ramps.gray[600],
      shipping:        ramps.emerald[600],  // "Free" highlights green
      savings:         ramps.rose[600],
    },

    trust: {
      icon:            ramps.emerald[600],
      text:            ramps.gray[600],
    },

    gradient: {
      heroBg:     "linear-gradient(135deg, #fff7ed 0%, #ffffff 50%, #fef2f2 100%)",
      promoBg:    "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
      darkSection:"linear-gradient(135deg, #111827 0%, #1f2937 100%)",
      saleBanner: "linear-gradient(90deg, #f97316 0%, #ef4444 100%)",
    },
  },

  borderRadius: {
    ...borderRadius,
    button:      "0.375rem",  // md — slightly less round for authority
    input:       "0.375rem",
    card:        "0.5rem",    // lg
    productCard: "0.75rem",   // xl
    modal:       "0.75rem",
    badge:       "0.25rem",   // square-ish badges (not pill) for product labels
  },

  components: {
    button: {
      // Add-to-cart button
      addToCart: {
        bg:         ramps.orange[500],
        bgHover:    ramps.orange[600],
        text:       ramps.white,
        radius:     "0.375rem",
        fontWeight: fontWeight.semibold,
        shadow:     glowShadows.amber,
      },
      // Buy now (higher urgency)
      buyNow: {
        bg:         ramps.gray[900],
        bgHover:    ramps.gray[800],
        text:       ramps.white,
        radius:     "0.375rem",
        fontWeight: fontWeight.semibold,
      },
      // Wishlist
      wishlist: {
        color:      ramps.rose[500],
        colorHover: ramps.rose[600],
      },
    },

    productCard: {
      shadow:           shadows.sm,
      shadowHover:      shadows.lg,
      radius:           "0.75rem",
      imageRadius:      "0.75rem 0.75rem 0 0",
      imageAspect:      "1 / 1",   // square
      overlayBg:        "rgba(0,0,0,0.03)",
      quickViewBg:      ramps.white,
      transitionSpeed:  "200ms",
    },

    reviewCard: {
      starColor:        ramps.amber[400],
      verifiedColor:    ramps.emerald[600],
      authorWeight:     fontWeight.semibold,
    },

    trustBadge: {
      iconColor:   ramps.emerald[600],
      iconBg:      ramps.emerald[50],
      textColor:   ramps.gray[700],
    },

    promoBar: {
      bg:          "linear-gradient(90deg, #f97316 0%, #ef4444 100%)",
      text:        ramps.white,
      linkColor:   ramps.yellow[200],
    },

    checkout: {
      summaryBg:   ramps.gray[50],
      totalColor:  ramps.gray[900],
      ctaBg:       ramps.orange[500],
      ctaHover:    ramps.orange[600],
    },
  },

  // ── Tailwind class references ────────────────────────────────────────────
  tw: {
    heroTitle:       "text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900",
    heroSub:         "text-lg sm:text-xl text-gray-600 leading-relaxed",
    addToCart:       "bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md transition-colors",
    buyNow:          "bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-md transition-colors",
    priceOriginal:   "text-2xl font-bold text-gray-900",
    priceSale:       "text-2xl font-bold text-rose-600",
    priceStrike:     "text-lg text-gray-400 line-through",
    badge:           "inline-flex px-2 py-0.5 text-xs font-semibold rounded text-white",
    badgeSale:       "bg-rose-500",
    badgeNew:        "bg-emerald-500",
    badgeBestseller: "bg-amber-500",
    starFilled:      "text-amber-400",
    starEmpty:       "text-gray-200",
    inStock:         "text-emerald-600",
    lowStock:        "text-amber-600 font-medium",
    outOfStock:      "text-gray-400",
    productCard:     "bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200 overflow-hidden",
    sectionBg:       "bg-white",
    altBg:           "bg-gray-50",
    promoBar:        "bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium py-2.5 text-center",
  },
};