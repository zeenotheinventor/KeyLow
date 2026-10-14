import { render, screen } from "@testing-library/react-native";

import DiaryRoute from "../app/(tabs)/diary";
import { ThemeProvider } from "../lib/theme";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

describe("diary route", () => {
  beforeEach(async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <DiaryRoute />
      </ThemeProvider>,
    );
  });

  it("should keep the diary heading", () => {
    expect(screen.getByRole("heading", { name: "Diary" })).toBeOnTheScreen();
  });

  it("should say what the diary will show, under Coming soon", () => {
    expect(screen.getByRole("heading", { name: "Coming soon" })).toBeOnTheScreen();
    expect(screen.getByText("Your logged foods will appear here, day by day.")).toBeOnTheScreen();
  });

  it("should have no Find food button, because the search launcher in the tab bar replaces it", () => {
    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
  });
});
