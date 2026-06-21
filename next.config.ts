import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth"],
  turbopack: {},
  // Hide the dev "Compiling…" badge so route navigations show our PageLoader instead.
  devIndicators: false,
};

export default nextConfig;
