// src/lib/ai/context/image-resolver.ts
// v1.0 — Fetches contextually relevant images from Unsplash and Pexels
// before codegen runs, so the LLM can embed real image URLs in components.
//
// USAGE:
//   const images = await resolveProjectImages(prompt, projectType, {
//     unsplashKey: process.env.UNSPLASH_ACCESS_KEY,
//     pexelsKey:   process.env.PEXELS_API_KEY,
//   });
//   // Then inject images.contextBlock into your system prompt

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageResult {
  url:         string;   // Full-size URL (use for backgrounds, heroes)
  thumbUrl:    string;   // Thumbnail URL (use for cards, grids)
  alt:         string;   // Descriptive alt text
  credit:      string;   // Photographer name
  source:      "unsplash" | "pexels";
  width:       number;
  height:      number;
}

export interface ProjectImages {
  hero:         ImageResult[];   // 2-3 full-bleed background images
  features:     ImageResult[];   // 3-6 feature section images
  gallery:      ImageResult[];   // 6-12 gallery/grid images
  avatars:      ImageResult[];   // 4-8 human portrait images (for testimonials)
  backgrounds:  ImageResult[];   // 2-4 abstract/texture backgrounds
  contextBlock: string;          // Pre-formatted prompt injection string
}

export interface ImageResolverOptions {
  unsplashKey?: string;
  pexelsKey?:   string;
  maxHero?:     number;   // default 3
  maxFeatures?: number;   // default 6
  maxGallery?:  number;   // default 9
  maxAvatars?:  number;   // default 6
}

// ─── Query Builder ────────────────────────────────────────────────────────────

/**
 * Derives search queries from the project prompt and type.
 * Different image roles need different queries for contextual relevance.
 */
function buildQueries(prompt: string, projectType: string): {
  hero:        string;
  features:    string;
  gallery:     string;
  avatars:     string;
  backgrounds: string;
} {
  const p = (prompt + " " + projectType).toLowerCase();
  const isTech = /tech|technology|ai|software|developer|coding|startup|app/.test(p);

  // Hero / banner — wide, atmospheric images
  let hero = "modern technology abstract";
  if (/saas|dashboard|analytics|b2b/.test(p))    hero = "modern office workspace technology";
  if (/ecommerce|shop|fashion/.test(p))           hero = "fashion lifestyle minimal clean";
  if (/finance|fintech|banking/.test(p))          hero = "finance city skyline professional";
  if (/health|medical|wellness/.test(p))          hero = "healthcare wellness clean light";
  if (/education|learning|course/.test(p))        hero = "education students learning study";
  if (/creative|agency|portfolio/.test(p))        hero = "creative studio design abstract";
  if (/streaming|music|entertainment/.test(p))    hero = "music concert neon lights";
  if (/food|restaurant|chef/.test(p))             hero = "food restaurant gourmet";
  if (/travel|hotel|tourism/.test(p))             hero = "travel landscape aerial destination";
  if (/startup|launch/.test(p))                   hero = "startup team collaboration modern";
  if (isTech)                                     hero = "technology workspace futuristic interface";

  // Features — product/service illustrations
  let features = "business productivity tools";
  if (/saas|dashboard/.test(p))   features = "productivity software dashboard analytics";
  if (/ecommerce/.test(p))        features = "shopping online product delivery";
  if (/finance/.test(p))          features = "finance investment growth chart";
  if (/health/.test(p))           features = "health medical professional care";
  if (/education/.test(p))        features = "learning books study education";
  if (/creative/.test(p))         features = "design creativity art studio";
  if (/food/.test(p))             features = "food ingredients cooking kitchen";
  if (/travel/.test(p))           features = "travel adventure explore map";
  if (isTech)                     features = "technology product interface developer setup";

  // Gallery — content grid images
  let gallery = "modern lifestyle product";
  if (/ecommerce|shop/.test(p))   gallery = "product lifestyle minimal white background";
  if (/portfolio|agency/.test(p)) gallery = "design project creative work";
  if (/food/.test(p))             gallery = "food photography gourmet meal";
  if (/travel/.test(p))           gallery = "travel destination landscape city";
  if (/fashion/.test(p))          gallery = "fashion clothing style outfit";
  if (isTech)                     gallery = "technology device workspace code screen";

  // Avatars — always human portraits for testimonials
  const avatars = "professional portrait headshot person";

  // Backgrounds — abstract textures
  let backgrounds = "abstract gradient dark texture";
  if (/light|white|clean/.test(p)) backgrounds = "abstract minimal white texture light";
  if (/dark|night/.test(p))        backgrounds = "abstract dark gradient texture";
  if (/nature/.test(p))            backgrounds = "nature abstract texture organic";

  return { hero, features, gallery, avatars, backgrounds };
}

// ─── Unsplash Fetcher ─────────────────────────────────────────────────────────

async function fetchUnsplash(
  query:       string,
  count:       number,
  apiKey:      string,
  orientation: "landscape" | "portrait" | "squarish" = "landscape",
): Promise<ImageResult[]> {
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=${orientation}&content_filter=high`;
    const res  = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${apiKey}`,
        "Accept-Version": "v1",
      },
    });

    if (!res.ok) {
      console.warn(`[image-resolver] Unsplash ${res.status} for "${query}"`);
      return [];
    }

    const data = await res.json() as {
      results: Array<{
        id:          string;
        urls:        { full: string; regular: string; small: string; thumb: string };
        alt_description: string | null;
        description: string | null;
        width:       number;
        height:      number;
        user:        { name: string };
      }>;
    };

    return (data.results ?? []).map((photo) => ({
      url:      photo.urls.regular,     // 1080px wide — good for most uses
      thumbUrl: photo.urls.small,       // 400px wide — good for cards
      alt:      photo.alt_description ?? photo.description ?? query,
      credit:   photo.user.name,
      source:   "unsplash" as const,
      width:    photo.width,
      height:   photo.height,
    }));
  } catch (e) {
    console.warn(`[image-resolver] Unsplash fetch failed: ${String(e)}`);
    return [];
  }
}

// ─── Pexels Fetcher ───────────────────────────────────────────────────────────

async function fetchPexels(
  query:       string,
  count:       number,
  apiKey:      string,
  orientation: "landscape" | "portrait" | "square" = "landscape",
): Promise<ImageResult[]> {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=${orientation}`;
    const res  = await fetch(url, {
      headers: { Authorization: apiKey },
    });

    if (!res.ok) {
      console.warn(`[image-resolver] Pexels ${res.status} for "${query}"`);
      return [];
    }

    const data = await res.json() as {
      photos: Array<{
        id:           number;
        width:        number;
        height:       number;
        alt:          string;
        photographer: string;
        src: {
          original:  string;
          large2x:   string;
          large:     string;
          medium:    string;
          small:     string;
          portrait:  string;
          landscape: string;
          tiny:      string;
        };
      }>;
    };

    return (data.photos ?? []).map((photo) => ({
      url:      photo.src.large,        // ~1200px — good quality, not too heavy
      thumbUrl: photo.src.medium,       // ~500px
      alt:      photo.alt || query,
      credit:   photo.photographer,
      source:   "pexels" as const,
      width:    photo.width,
      height:   photo.height,
    }));
  } catch (e) {
    console.warn(`[image-resolver] Pexels fetch failed: ${String(e)}`);
    return [];
  }
}

// ─── Fallback Images ──────────────────────────────────────────────────────────
// Used when both APIs are unavailable or keys are missing.
// These are stable Unsplash image URLs that don't require authentication.
const STABLE_FALLBACK_URLS: Record<string, string[]> = {
  tech: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
    "https://images.unsplash.com/photo-1560264357-8d9766c54b0f",
  ],
  business: [
    "https://images.unsplash.com/photo-1552664730-d307ca884978",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f",
    "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37",
  ],
  lifestyle: [
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b",
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
  ],
  food: [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4",
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe",
  ],
  travel: [
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
  ],
  abstract: [
    "https://images.unsplash.com/photo-1557682250-33bd709cbe85",
    "https://images.unsplash.com/photo-1557683316-973673baf926",
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809",
  ],
};

function pickFallbackBucket(query: string): string[] {
  const q = query.toLowerCase();
  if (/tech|technology|software|developer|coding|device|interface|dashboard|ai/.test(q)) return STABLE_FALLBACK_URLS.tech;
  if (/food|restaurant|kitchen|meal|chef|drink|cafe/.test(q)) return STABLE_FALLBACK_URLS.food;
  if (/travel|tour|hotel|destination|landscape|adventure/.test(q)) return STABLE_FALLBACK_URLS.travel;
  if (/fashion|lifestyle|portrait|avatar|person|clothing|style/.test(q)) return STABLE_FALLBACK_URLS.lifestyle;
  if (/abstract|gradient|texture|background/.test(q)) return STABLE_FALLBACK_URLS.abstract;
  return STABLE_FALLBACK_URLS.business;
}

function makeFallbackImages(query: string, count: number, orientation: "landscape" | "portrait" = "landscape"): ImageResult[] {
  const w = orientation === "landscape" ? 1200 : 800;
  const h = orientation === "landscape" ? 800  : 1000;
  
  // Use Unsplash Source API (no auth required) for dynamic image fetching
  // Format: https://source.unsplash.com/{width}x{height}/?{query}
  // Each generated URL will redirect to a different random image matching the query
  return Array.from({ length: count }, (_, i) => {
    // Add random seed to each URL to ensure different images each time
    const seed = Math.random().toString(36).substring(7);
    const sourceUrl = `https://source.unsplash.com/${w}x${h}/?${encodeURIComponent(query)}&${seed}`;
    
    return {
      url:      sourceUrl,
      thumbUrl: sourceUrl,
      alt:      `${query} image ${i + 1}`,
      credit:   "Unsplash Source API",
      source:   "unsplash" as const,
      width:    w,
      height:   h,
    };
  });
}

// ─── Core Resolver ────────────────────────────────────────────────────────────

export async function resolveProjectImages(
  prompt:      string,
  projectType: string,
  options:     ImageResolverOptions = {},
): Promise<ProjectImages> {
  const {
    unsplashKey,
    pexelsKey,
    maxHero       = 3,
    maxFeatures   = 6,
    maxGallery    = 9,
    maxAvatars    = 6,
  } = options;

  const hasUnsplash = Boolean(unsplashKey);
  const hasPexels   = Boolean(pexelsKey);

  if (!hasUnsplash && !hasPexels) {
    console.log("[image-resolver] No API keys — using fallback URLs");
  }

  const queries = buildQueries(prompt, projectType);

  console.log(`[image-resolver] Fetching images for ${projectType}: ${JSON.stringify(queries)}`);

  // ── Fetch in parallel ──────────────────────────────────────────────────────
  const [
    heroImages,
    featureImages,
    galleryImages,
    avatarImages,
    backgroundImages,
  ] = await Promise.all([
    // Hero: prefer landscape, use Unsplash first then Pexels as fallback
    fetchImages(queries.hero,        maxHero,     "landscape", unsplashKey, pexelsKey),
    fetchImages(queries.features,    maxFeatures, "landscape", unsplashKey, pexelsKey),
    fetchImages(queries.gallery,     maxGallery,  "squarish",  unsplashKey, pexelsKey),
    fetchImages(queries.avatars,     maxAvatars,  "portrait",  unsplashKey, pexelsKey),
    fetchImages(queries.backgrounds, 3,           "landscape", unsplashKey, pexelsKey),
  ]);

  const images: ProjectImages = {
    hero:        heroImages,
    features:    featureImages,
    gallery:     galleryImages,
    avatars:     avatarImages,
    backgrounds: backgroundImages,
    contextBlock: "",
  };

  images.contextBlock = buildContextBlock(images);

  console.log(`[image-resolver] ✓ Hero: ${heroImages.length}, Features: ${featureImages.length}, Gallery: ${galleryImages.length}, Avatars: ${avatarImages.length}`);

  return images;
}

// ─── Fetch Helper (Unsplash → Pexels → Fallback) ─────────────────────────────

async function fetchImages(
  query:        string,
  count:        number,
  orientation:  "landscape" | "portrait" | "squarish",
  unsplashKey?: string,
  pexelsKey?:   string,
): Promise<ImageResult[]> {
  // Try Unsplash first
  if (unsplashKey) {
    const results = await fetchUnsplash(
      query,
      count,
      unsplashKey,
      orientation === "squarish" ? "squarish" : orientation,
    );
    if (results.length > 0) return results;
  }

  // Fall back to Pexels
  if (pexelsKey) {
    const pexelsOrientation = orientation === "squarish" ? "square" : orientation;
    const results = await fetchPexels(query, count, pexelsKey, pexelsOrientation);
    if (results.length > 0) return results;
  }

  // Fall back to unsigned Unsplash source URLs
  return makeFallbackImages(query, count, orientation === "portrait" ? "portrait" : "landscape");
}

// ─── Prompt Context Block Builder ─────────────────────────────────────────────

/**
 * Builds the text block that gets injected into the LLM system prompt.
 * Format is deliberately terse to save tokens while being unambiguous.
 */
function buildContextBlock(images: ProjectImages): string {
  // Helper to wrap image URLs in proxy format for COEP-restricted iframes
  const proxyUrl = (url: string) => `/api/image?url=${encodeURIComponent(url)}`;

  const lines: string[] = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "REAL IMAGES — use these PROXIED URLs directly in src/style={{}} or <img src=>",
    "Each URL is already wrapped through /api/image?url= to work in the WebContainer iframe.",
    "Do NOT use placeholder.com, picsum.photos, via.placeholder.com, or any fake URL.",
    "Do NOT strip the /api/image?url= wrapper or use raw CDN URLs — they will fail in COEP mode.",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ];

  if (images.hero.length > 0) {
    lines.push("\nHERO BACKGROUNDS (use in CSS backgroundImage or full-bleed <img>):");
    images.hero.forEach((img, i) =>
      lines.push(`  hero_${i + 1}: "${proxyUrl(img.url)}"  /* ${img.alt} — by ${img.credit} */`)
    );
  }

  if (images.features.length > 0) {
    lines.push("\nFEATURE / SECTION IMAGES (use in feature cards, illustration slots):");
    images.features.forEach((img, i) =>
      lines.push(`  feature_${i + 1}: "${proxyUrl(img.url)}"  /* ${img.alt} */`)
    );
  }

  if (images.gallery.length > 0) {
    lines.push("\nGALLERY IMAGES (use in grids, carousels, product listings):");
    images.gallery.forEach((img, i) =>
      lines.push(`  gallery_${i + 1}: "${proxyUrl(img.thumbUrl)}"  /* ${img.alt} */`)
    );
  }

  if (images.avatars.length > 0) {
    lines.push("\nAVATAR / PORTRAIT IMAGES (use in testimonials, team sections, author cards):");
    images.avatars.forEach((img, i) =>
      lines.push(`  avatar_${i + 1}: "${proxyUrl(img.thumbUrl)}"  /* photo by ${img.credit} */`)
    );
  }

  if (images.backgrounds.length > 0) {
    lines.push("\nBACKGROUND TEXTURES (use as section backgrounds):");
    images.backgrounds.forEach((img, i) =>
      lines.push(`  bg_texture_${i + 1}: "${proxyUrl(img.url)}"  /* ${img.alt} */`)
    );
  }

  lines.push("\nIMPORTANT: Embed these URLs verbatim (with /api/image?url= prefix intact).");
  lines.push("Do not modify, truncate, or unwrap them or images will fail in the WebContainer iframe.");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return lines.join("\n");
}

// ─── Convenience: component-role image picker ─────────────────────────────────

/**
 * Given a component path/description and the resolved image set,
 * returns the most relevant images for that specific component.
 * Used in getComponentRoleInstructions() to inject targeted image hints.
 */
export function pickImagesForRole(
  componentPath: string,
  componentDesc: string,
  images:        ProjectImages,
): { inlineHint: string; images: ImageResult[] } {
  const p = (componentPath + " " + componentDesc).toLowerCase();

  let primary:   ImageResult | null = null;
  let secondary: ImageResult[] = [];

  if (/hero|banner|splash/.test(p)) {
    primary   = images.hero[0] ?? null;
    secondary = images.hero.slice(1, 3);
  } else if (/testimonial|review|team/.test(p)) {
    primary   = images.avatars[0] ?? null;
    secondary = images.avatars.slice(1, 5);
  } else if (/feature/.test(p)) {
    primary   = images.features[0] ?? null;
    secondary = images.features.slice(1, 4);
  } else if (/gallery|grid|portfolio|product/.test(p)) {
    primary   = images.gallery[0] ?? null;
    secondary = images.gallery.slice(0, 8);
  } else if (/cta|background|section/.test(p)) {
    primary   = images.backgrounds[0] ?? null;
    secondary = images.backgrounds.slice(1);
  }

  const imagesToReturn = primary ? [primary, ...secondary] : secondary;
  const inlineHint = buildInlineHint(primary, secondary, p);
  return { inlineHint, images: imagesToReturn };
}

function buildInlineHint(
  primary:   ImageResult | null,
  secondary: ImageResult[],
  role:      string,
): string {
  if (!primary && secondary.length === 0) return "";

  const lines = ["IMAGES FOR THIS COMPONENT:"];

  if (primary) {
    if (/hero|banner/.test(role)) {
      lines.push(`  Use as hero background: style={{ backgroundImage: 'url("${primary.url}")', backgroundSize: 'cover', backgroundPosition: 'center' }}`);
    } else if (/testimonial|team/.test(role)) {
      lines.push(`  First avatar: <img src="${primary.url}" alt="${primary.alt}" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />`);
    } else {
      lines.push(`  Primary image: "${primary.url}"`);
    }
  }

  if (secondary.length > 0) {
    if (/testimonial|team/.test(role)) {
      lines.push("  More avatars:");
      secondary.forEach((img, i) =>
        lines.push(`    avatar_${i + 2}: "${img.thumbUrl}"  /* ${img.credit} */`)
      );
    } else if (/gallery|grid/.test(role)) {
      lines.push("  Gallery items:");
      secondary.forEach((img, i) =>
        lines.push(`    item_${i + 1}: "${img.thumbUrl}"  /* ${img.alt} */`)
      );
    }
  }

  return lines.join("\n");
}
