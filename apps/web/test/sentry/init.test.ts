import { init } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initSentry } from "@/lib/sentry/init";
import { scrubBreadcrumb, scrubEvent } from "@/lib/sentry/scrub";

vi.mock("@sentry/nextjs", () => ({ init: vi.fn() }));

const DSN = "https://publickey@o1.ingest.de.sentry.io/2";

describe("initSentry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(init).mockClear();
  });

  it("should not start Sentry when there is no DSN, so nothing is sent from dev, tests or CI", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");

    initSentry();

    expect(init).not.toHaveBeenCalled();
  });

  it.each(["preview", "development", ""])(
    "should not start Sentry with a DSN on the %j environment, so a local or CI build sends nothing",
    (environment) => {
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
      vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", environment);

      initSentry();

      expect(init).not.toHaveBeenCalled();
    },
  );

  it("should start Sentry with the DSN, no personal data, no tracing and the scrubbing hooks", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", "724b803");

    initSentry();

    expect(init).toHaveBeenCalledExactlyOnceWith({
      dsn: DSN,
      environment: "production",
      release: "724b803",
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
  });

  it("should add no integrations, so session replay is never on", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");

    initSentry();

    expect(vi.mocked(init).mock.calls[0]?.[0]).not.toHaveProperty("integrations");
    expect(vi.mocked(init).mock.calls[0]?.[0]).not.toHaveProperty("replaysSessionSampleRate");
  });
});
