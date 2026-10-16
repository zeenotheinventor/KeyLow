import { withSentryConfig } from "@sentry/nextjs/config";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stops `next dev` from writing AGENTS.md and CLAUDE.md into the repository.
  agentRules: false,
  transpilePackages: ["@keylow/core", "@keylow/api-client", "@keylow/db", "@keylow/tokens"],
  // The browser sees no Vercel system variable, so the two Sentry reads are filled in at build time.
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
};

// Source maps upload from the Vercel build only when SENTRY_AUTH_TOKEN is set. Without it nothing
// is generated for Sentry, nothing is uploaded and the build says nothing about it.
const canUploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  org: "sojisoft-limited",
  project: "keylow-web",
  sentryUrl: "https://de.sentry.io",
  silent: !canUploadSourceMaps,
  telemetry: false,
  sourcemaps: {
    disable: !canUploadSourceMaps,
    // The maps are deleted once uploaded, so the deploy does not serve them.
    deleteSourcemapsAfterUpload: true,
  },
});
