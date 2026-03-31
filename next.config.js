/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "utfs.io",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "files.stripe.com",
      },
    ],
  },
  reactStrictMode: false,

  // ✅ CRITICAL FOR WEBCONTAINER — SharedArrayBuffer requires these two headers.
  // Without them the container throws:
  //   "SharedArrayBuffer transfer requires self.crossOriginIsolated"
  // and the preview never loads. These headers enable cross-origin isolation
  // on every page/API response served by Next.js.
  async headers() {
    return [
      {
        // Apply to ALL routes
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;