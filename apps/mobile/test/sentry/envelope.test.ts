import { addBreadcrumb, captureException, close, flush, setUser } from "@sentry/react-native";

import { initSentry } from "../../lib/sentry/init";
import { reportKeyboardLiftOutOfRange } from "../../lib/sentry/reportKeyboardLiftOutOfRange";
import { recordAppState, recordKeyboard, recordRoute } from "../../lib/sentry/trail";

import type { ReactNativeOptions } from "@sentry/react-native";

// The envelopes the real SDK hands to its transport, each as the text that would be sent.
const sentEnvelopes: string[] = [];
// The type of every item in those envelopes: an event, a session, a client report and so on.
const sentItemTypes: unknown[] = [];

type Transport = ReturnType<NonNullable<ReactNativeOptions["transport"]>>;

jest.mock("expo-updates", () => ({ updateId: null, runtimeVersion: null }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: null } }));
// The SDK is the real one. Only where it sends to is replaced, and the native side it has no phone for is left off.
jest.mock("@sentry/react-native", () => {
  // The SDK starts a timer as it loads, which would keep Jest from exiting, so it starts a fake one.
  jest.useFakeTimers();
  const actual = jest.requireActual<typeof import("@sentry/react-native")>("@sentry/react-native");
  jest.useRealTimers();

  return {
    ...actual,
    init: (options: ReactNativeOptions) => {
      actual.init({
        ...options,
        enableNative: false,
        autoInitializeNativeSdk: false,
        transport: () => ({
          send: (envelope: Parameters<Transport["send"]>[0]) => {
            sentEnvelopes.push(JSON.stringify(envelope));
            sentItemTypes.push(...envelope[1].map(([itemHeader]) => itemHeader.type));
            return Promise.resolve({});
          },
          flush: () => Promise.resolve(true),
        }),
      });
    },
  };
});

const WEIGHT = "82.4 kg";
const FOOD_NAME = "Chicken breast";

function setDevelopmentFlag(isDevelopment: boolean) {
  Reflect.set(globalThis, "__DEV__", isDevelopment);
}

describe("an error reported through the real Sentry SDK", () => {
  let consoleLog: jest.SpyInstance;

  beforeAll(() => {
    // Set before the SDK starts, so the SDK wraps the spy as it would wrap the real console, and the test
    // does not print the line it logs.
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://publickey@o1.ingest.de.sentry.io/2";
    setDevelopmentFlag(false);
    initSentry();
  });

  afterAll(async () => {
    await close();
    consoleLog.mockRestore();
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    setDevelopmentFlag(true);
  });

  it("should leave no weight, food name or search text in the envelope", async () => {
    setUser({ id: "5f1c", email: "a@b.com", username: "zee", ip_address: "1.2.3.4" });
    addBreadcrumb({
      category: "fetch",
      type: "http",
      data: {
        url: `https://x.supabase.co/rest/v1/foods?name=ilike.*${encodeURIComponent(FOOD_NAME)}*`,
        method: "GET",
        status_code: 200,
        "http.query": `name=ilike.*${encodeURIComponent(FOOD_NAME)}*`,
      },
    });
    addBreadcrumb({
      category: "touch",
      type: "user",
      message: `Touch event within element: Delete ${FOOD_NAME}`,
    });
    addBreadcrumb({
      category: "navigation",
      data: { from: "/foods", to: `/foods?q=${FOOD_NAME}` },
    });

    console.log(`Logged ${FOOD_NAME} at ${WEIGHT}`);

    captureException(new Error(`Could not log the food: "${FOOD_NAME}" at ${WEIGHT}`));
    captureException({
      code: "23505",
      details: `Key (name)=(${FOOD_NAME}) exists`,
      weight: WEIGHT,
    });
    await flush();

    const payload = sentEnvelopes.join("\n");
    expect(sentEnvelopes.length).toBeGreaterThanOrEqual(2);
    expect(sentItemTypes).toEqual(sentItemTypes.map(() => "event"));
    expect(payload).not.toContain(WEIGHT);
    expect(payload).not.toContain(FOOD_NAME);
    expect(payload).not.toContain("Chicken%20breast");
    expect(payload).not.toContain("a@b.com");
    expect(payload).not.toContain("1.2.3.4");
    expect(payload).toContain("5f1c");
    expect(payload).toContain("/rest/v1/foods");
  });
  it("should send the keyboard lift report with its tags and the trail of the screens, app state and keyboard", async () => {
    sentEnvelopes.length = 0;
    recordRoute("/recipes/[id]/edit");
    recordAppState("background");
    recordAppState("active");
    recordKeyboard("show", { screenY: 0, height: 300 });

    reportKeyboardLiftOutOfRange({
      rawLift: 800,
      screenY: 0,
      keyboardHeight: 300,
      windowHeight: 800,
    });
    await flush();

    const payload = sentEnvelopes.join("\n");
    expect(payload).toContain("Keyboard lift out of range");
    expect(payload).toContain('"route":"/recipes/[id]/edit"');
    expect(payload).toContain('"rawLift":"800"');
    expect(payload).toContain('"category":"app.state"');
    expect(payload).toContain('"category":"keyboard"');
    expect(payload).toContain('"state":"background"');
    expect(payload).toContain('"event":"show"');
  });
});
