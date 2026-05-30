import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /** Static HTML export for GoDaddy/cPanel (upload `out/`). Omit for Node hosting. */
  output: process.env.OORJAMAN_STATIC_EXPORT === "1" ? "export" : undefined,
  images: { unoptimized: true },
  transpilePackages: ["@oorjaman/config"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
