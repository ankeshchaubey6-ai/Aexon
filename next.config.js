/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "files.stripe.com" },
    ],
  },
  reactStrictMode: false,

  async headers() {
    return [
      {
        // Apply to ALL routes — WebContainer requires crossOriginIsolated = true
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            // same-origin: required for SharedArrayBuffer / WebContainer
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            // credentialless: enables crossOriginIsolated WITHOUT blocking
            // third-party resources (Clerk, Cloudinary, Google Fonts, Stripe).
            // require-corp breaks any external resource that doesn't send
            // Cross-Origin-Resource-Policy, including Clerk's auth iframes.
            value: "credentialless",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;