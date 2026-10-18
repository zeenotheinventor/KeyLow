import { render, screen } from "@testing-library/react-native";

import { DashboardBodyMapMessage } from "../../components/DashboardScreen/DashboardBodyMapMessage";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { DashboardBodyMapMessageProps } from "../../components/DashboardScreen/DashboardBodyMapMessage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

async function renderMessage(kind: DashboardBodyMapMessageProps["kind"]) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <DashboardBodyMapMessage kind={kind} />
    </ThemeProvider>,
  );
}

describe("DashboardBodyMapMessage", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DashboardScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it.each([
    ["failed", "Couldn't load the body map"],
    ["offline", "The body map isn't available offline."],
  ] as const)("should keep the card's title and say, when it is %s, %j", async (kind, line) => {
    await renderMessage(kind);

    expect(screen.getByText("Training")).toBeOnTheScreen();
    expect(screen.getByText(line)).toBeOnTheScreen();
  });

  it.each(["failed", "offline"] as const)(
    "should offer nothing to press when it is %s, because the line is quiet",
    async (kind) => {
      await renderMessage(kind);

      expect(screen.queryAllByRole("button")).toHaveLength(0);
      expect(screen.queryAllByRole("alert")).toHaveLength(0);
    },
  );
});
