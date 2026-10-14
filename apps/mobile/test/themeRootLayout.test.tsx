import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import RootLayout from "../app/_layout";
import { useTheme } from "../lib/theme";
import { resetRouterMock } from "./support/expoRouterMock";
import { resetSupabaseMock } from "./support/supabaseMock";

// Metro compiles the stylesheet. Jest cannot read it.
jest.mock("../global.css", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
// Stands for the navigator and the screens in it, which read the theme.
function MockStack() {
  return <Text>{`Screens in ${useTheme().scheme}`}</Text>;
}
// The layout declares the options of a screen with `Stack.Screen`, which draws nothing.
MockStack.Screen = function MockScreen() {
  return null;
};

jest.mock("expo-router", () => ({
  ...jest.requireActual<{ mockExpoRouter: object }>("./support/expoRouterMock").mockExpoRouter,
  Stack: MockStack,
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

describe("root layout", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
  });

  it("should give the screens the theme, dark by default", async () => {
    await render(<RootLayout />);

    expect(await screen.findByText("Screens in dark")).toBeOnTheScreen();
  });
});
