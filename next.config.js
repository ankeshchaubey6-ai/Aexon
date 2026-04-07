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
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",           // was: same-origin-allow-popups
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",          // was: credentialless
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;