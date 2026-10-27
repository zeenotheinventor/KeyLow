import { waitFor } from "@testing-library/react-native";
import * as Updates from "expo-updates";

import { installFatalRestart } from "../../lib/sentry/fatalRestart";
import { initSentry } from "../../lib/sentry/init";

import type { ReactNativeOptions } from "@sentry/react-native";

type Transport = ReturnType<NonNullable<ReactNativeOptions["transport"]>>;
type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

// What happened, in the order it happened: an envelope reaching the transport, and the app restarting.
const happened: string[] = [];
// The envelopes the real SDK hands to its transport, each as the text that would be sent.
const sentEnvelopes: string[] = [];

jest.mock("expo-updates", () => ({
  isEnabled: true,
  updateId: null,
  runtimeVersion: null,
  reloadAsync: jest.fn(() => {
    happened.push("restart");

    return Promise.resolve();
  }),
}));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: null } }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
  },
}));
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
            happened.push("sent");
            sentEnvelopes.push(JSON.stringify(envelope));
            return Promise.resolve({});
          },
          flush: () => Promise.resolve(true),
        }),
      });
    },
  };
});

const DSN = "https://publickey@o1.ingest.de.sentry.io/2";
const WEIGHT = "82.4 kg";

// React Native declares the flag as a constant, so Jest's own global is set by name.
function setDevelopmentFlag(isDevelopment: boolean) {
  Reflect.set(globalThis, "__DEV__", isDevelopment);
}

describe("a fatal error with the real Sentry SDK", () => {
  const realDefaultHandler = jest.fn<undefined, Parameters<GlobalHandler>>();
  let globalHandler: GlobalHandler = realDefaultHandler;
  let consoleLog: jest.SpyInstance;
  let dateNow: jest.SpyInstance;
  let clock = Date.now();

  beforeAll(async () => {
    dateNow = jest.spyOn(Date, "now").mockImplementation(() => clock);
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN;
    setDevelopmentFlag(false);
    // The handler the app has before either of them starts is React Native's own.
    Reflect.set(globalThis, "ErrorUtils", {
      getGlobalHandler: () => globalHandler,
      setGlobalHandler: (handler: GlobalHandler) => {
        globalHandler = handler;
      },
    });

    // This is the order of the root layout: the SDK takes the handler that is there when it starts, as the
    // one it calls last, so the restart is installed first to be that one.
    installFatalRestart();
    initSentry();
    for (let turn = 0; turn < 10; turn += 1) {
      await Promise.resolve();
    }
    // A restart is not made in the first moments of a start, which expo-updates watches.
    clock += 30_000;
  });

  afterAll(() => {
    consoleLog.mockRestore();
    dateNow.mockRestore();
    Reflect.deleteProperty(globalThis, "ErrorUtils");
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    setDevelopmentFlag(true);
  });

  it("should send the one fatal event, scrubbed, before the app restarts", async () => {
    globalHandler(new Error(`Could not save the weight ${WEIGHT}`), true);
    await waitFor(() => {
      expect(Updates.reloadAsync).toHaveBeenCalled();
    });

    expect(happened).toEqual(["sent", "restart"]);
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(sentEnvelopes).toHaveLength(1);
    expect(realDefaultHandler).not.toHaveBeenCalled();
    const payload = sentEnvelopes.join("\n");
    expect(payload).toContain('"level":"fatal"');
    expect(payload).toContain('"handled":false');
    expect(payload).not.toContain(WEIGHT);
  });
});
