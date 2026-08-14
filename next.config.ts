import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["react-pluggy-connect", "pluggy-connect-sdk"],
};

export default nextConfig;
