import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Exclude whatsapp-service from the build
    config.externals = [
      ...(config.externals || []),
      { "@whiskeysockets/baileys": "@whiskeysockets/baileys" },
      { pino: "pino" },
      { "pino-http": "pino-http" },
    ];
    return config;
  },
};

export default nextConfig;
