import type { NextConfig } from "next";

/**
 * Next.js configuration.
 *
 * `serverExternalPackages` keeps Cheerio and the Prisma client out of the
 * bundler's module graph. They are plain Node libraries that must run as-is on
 * the server, and bundling them tends to break their dynamic requires.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["cheerio", "@prisma/client"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
