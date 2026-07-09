import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        "@whiskeysockets/baileys",
        "pino",
        "pino-http",
        "@prisma/adapter-pg"
      ];
    }
    return config;
  },
};

export default nextConfig;
