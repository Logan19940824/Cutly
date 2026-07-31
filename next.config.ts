import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["ali-oss", "bullmq", "ioredis", "sharp"],
};

export default nextConfig;
