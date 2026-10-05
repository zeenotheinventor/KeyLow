import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stops `next dev` from writing AGENTS.md and CLAUDE.md into the repository.
  agentRules: false,
  transpilePackages: ["@keylow/core", "@keylow/api-client", "@keylow/db", "@keylow/tokens"],
};

export default nextConfig;
