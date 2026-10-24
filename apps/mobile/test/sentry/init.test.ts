import { breadcrumbsIntegration, init } from "@sentry/react-native";

import { initSentry } from "../../lib/sentry/init";
import { scrubBreadcrumb, scrubEvent } from "../../lib/sentry/scrub";

import type { ReactNativeOptions } from "@sentry/react-native";

type Integration = ReturnType<typeof breadcrumbsIntegration>;

type MockUpdatesState = { updateId: string | null; runtimeVersion: string | null };

// What expo-updates reports, which a test changes. The mock reads it at call time.
const mockUpdatesState: MockUpdatesState = { updateId: null, runtimeVersion: null };

type MockExpoConstants = { expoConfig: { extra?: { appVariant?: string } } | null };

// What expo-constants reports of the Expo config, which a test changes.
const mockExpoConstants: MockExpoConstants = { expoConfig: null };

jest.mock("expo-updates", () => ({
  get updateId() {
    return mockUpdatesState.updateId;
  },
  get runtimeVersion() {
    return mockUpdatesState.runtimeVersion;
  },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConstants.expoConfig;
    },
  },
}));
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  breadcrumbsIntegration: jest.fn((options: object) => ({ name: "Breadcrumbs", options })),
}));

const DSN = "https://publickey@o1.ingest.de.sentry.io/2";

// React Native declares the flag as a constant, so Jest's own global is set by name.
function setDevelopmentFlag(isDevelopment: boolean) {
  Reflect.set(globalThis, "__DEV__", isDevelopment);
}

function lastInitOptions(): ReactNativeOptions {
  const options = jest.mocked(init).mock.calls[0]?.[0];
  if (options === undefined) {
    throw new Error("Sentry was not started");
  }

  return options;
}

// A stand-in for a default integration, which the code under test only passes along or leaves out.
const integrationNamed = (name: string): Integration => ({ name });

function integrationsFor(defaults: Integration[]): Integration[] {
  const { integrations } = lastInitOptions();
  if (typeof integrations !== "function") {
    throw new Error("The integrations are not a function of the defaults");
  }

  return integrations(defaults);
}

describe("initSentry", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN;
    delete process.env.EXPO_PUBLIC_COMMIT_SHA;
    mockUpdatesState.updateId = null;
    mockUpdatesState.runtimeVersion = null;
    mockExpoConstants.expoConfig = null;
    setDevelopmentFlag(false);
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    setDevelopmentFlag(true);
    jest.mocked(init).mockClear();
    jest.mocked(breadcrumbsIntegration).mockClear();
  });

  it("should not start Sentry when there is no DSN, so nothing is sent from a build without one", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = "";

    initSentry();

    expect(init).not.toHaveBeenCalled();
  });

  it("should not start Sentry in development, so nothing is sent from Metro, a dev client or Jest", () => {
    setDevelopmentFlag(true);

    initSentry();

    expect(init).not.toHaveBeenCalled();
  });

  it("should start Sentry with the DSN, no personal data, no tracing and the scrubbing hooks", () => {
    initSentry();

    expect(lastInitOptions()).toMatchObject({
      dsn: DSN,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
  });

  it("should call itself production when the build has no app variant", () => {
    initSentry();

    expect(lastInitOptions().environment).toBe("production");
  });

  it("should take the environment from the app variant of the build", () => {
    mockExpoConstants.expoConfig = { extra: { appVariant: "development" } };

    initSentry();

    expect(lastInitOptions().environment).toBe("development");
  });

  it("should group events by the commit, the running update and the runtime version", () => {
    process.env.EXPO_PUBLIC_COMMIT_SHA = "724b803";
    mockUpdatesState.updateId = "7a2e1d9c-0000-4000-8000-000000000001";
    mockUpdatesState.runtimeVersion = "e96c6399d019380ff92a6589084efea74e8fbcca";

    initSentry();

    expect(lastInitOptions()).toMatchObject({
      release: "724b803",
      dist: "7a2e1d9c-0000-4000-8000-000000000001",
      initialScope: { tags: { runtimeVersion: "e96c6399d019380ff92a6589084efea74e8fbcca" } },
    });
  });

  it("should fall back to the runtime version as the release for a build that has no commit", () => {
    mockUpdatesState.runtimeVersion = "e96c6399d019380ff92a6589084efea74e8fbcca";

    initSentry();

    expect(lastInitOptions().release).toBe("e96c6399d019380ff92a6589084efea74e8fbcca");
  });

  it("should leave the release and dist to the SDK when there is no commit, update or runtime version", () => {
    initSentry();

    expect(lastInitOptions()).toMatchObject({ release: undefined, dist: undefined });
  });

  it("should send no session and no client report, which the native SDK sends without the scrubbing hooks", () => {
    initSentry();

    expect(lastInitOptions()).toMatchObject({
      enableAutoSessionTracking: false,
      sendClientReports: false,
    });
  });

  it("should send no session replay, screenshot or view hierarchy", () => {
    initSentry();

    const options = lastInitOptions();
    expect(options.replaysSessionSampleRate).toBeUndefined();
    expect(options.replaysOnErrorSampleRate).toBeUndefined();
    expect(options.attachScreenshot).toBeFalsy();
    expect(options.attachViewHierarchy).toBeFalsy();
    expect(integrationsFor([]).map((integration) => integration.name)).not.toContain(
      "MobileReplay",
    );
  });

  it("should replace the default breadcrumbs with ones that record no console output", () => {
    const otherIntegration = integrationNamed("Dedupe");
    initSentry();

    const integrations = integrationsFor([integrationNamed("Breadcrumbs"), otherIntegration]);

    expect(breadcrumbsIntegration).toHaveBeenCalledTimes(1);
    expect(breadcrumbsIntegration).toHaveBeenCalledWith({ console: false });
    expect(integrations).toEqual([
      otherIntegration,
      { name: "Breadcrumbs", options: { console: false } },
    ]);
  });
});
