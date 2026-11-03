import { render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ListRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { ListRowProps } from "../../components/ui";

// The Assistant settings screen's two rows: "Use the assistant", a title with the switch at the end, and
// "Delete all conversations", a title in the danger colour with no chevron.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

async function renderRow(props: ListRowProps) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <ListRow {...props} />
    </ThemeProvider>,
  );
}

describe("ListRow with a switch", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should draw the title and a switch named for it, off", async () => {
    await renderRow({
      title: "Use the assistant",
      toggle: { isOn: false, label: "Use the assistant", onValueChange: () => undefined },
    });

    expect(
      screen.getByText("Use the assistant", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByRole("switch", { name: "Use the assistant" })).not.toBeChecked();
  });

  it("should leave the visible title out of the accessibility tree, so the switch is the one stop", async () => {
    await renderRow({
      title: "Use the assistant",
      subtitle: "Off until you turn it on",
      toggle: { isOn: false, label: "Use the assistant", onValueChange: () => undefined },
    });

    expect(screen.queryByText("Use the assistant")).not.toBeOnTheScreen();
    expect(screen.queryByText("Off until you turn it on")).not.toBeOnTheScreen();
    expect(screen.getAllByLabelText("Use the assistant")).toHaveLength(1);
  });

  it("should draw the switch on when it is on", async () => {
    await renderRow({
      title: "Use the assistant",
      toggle: { isOn: true, label: "Use the assistant", onValueChange: () => undefined },
    });

    expect(screen.getByRole("switch", { name: "Use the assistant" })).toBeChecked();
  });

  it("should ask for the opposite once when the switch is pressed", async () => {
    const onValueChange = jest.fn();
    const user = userEvent.setup();
    await renderRow({
      title: "Use the assistant",
      toggle: { isOn: false, label: "Use the assistant", onValueChange },
    });

    await user.press(screen.getByRole("switch", { name: "Use the assistant" }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it("should not respond while the switch is disabled", async () => {
    const onValueChange = jest.fn();
    const user = userEvent.setup();
    await renderRow({
      title: "Use the assistant",
      toggle: { isOn: false, label: "Use the assistant", onValueChange, disabled: true },
    });

    await user.press(screen.getByRole("switch", { name: "Use the assistant" }));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("should draw no chevron and leave the switch reachable on its own", async () => {
    await renderRow({
      title: "Use the assistant",
      toggle: { isOn: false, label: "Use the assistant", onValueChange: () => undefined },
    });

    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });
});

describe("ListRow with a danger title", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should draw the title in the danger colour", async () => {
    await renderRow({
      title: "Delete all conversations",
      titleTone: "danger",
      chevron: false,
      onPress: () => undefined,
    });

    expect(screen.getByText("Delete all conversations")).toHaveStyle({
      color: resolvedColor("dark", "danger"),
    });
  });

  it("should draw the title in the primary colour when it has no tone", async () => {
    await renderRow({ title: "Sign out", chevron: false, onPress: () => undefined });

    expect(screen.getByText("Sign out")).toHaveStyle({
      color: resolvedColor("dark", "text-primary"),
    });
  });
});
