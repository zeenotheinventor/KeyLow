import { readSetupMode } from "../../components/SetupScreen";

// The folder's index brings the screen with it, which reads the theme and the router.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

describe("readSetupMode", () => {
  it("should read first-run as the first run", () => {
    expect(readSetupMode("first-run")).toBe("first-run");
  });

  it("should read recalculate as a recalculation", () => {
    expect(readSetupMode("recalculate")).toBe("recalculate");
  });

  it.each([undefined, "", "First-Run", "onboarding", ["first-run"], ["first-run", "recalculate"]])(
    "should read %j as a recalculation",
    (parameter) => {
      expect(readSetupMode(parameter)).toBe("recalculate");
    },
  );
});
