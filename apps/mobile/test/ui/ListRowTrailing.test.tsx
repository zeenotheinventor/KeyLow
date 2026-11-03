import { render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ListRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { ListRowProps } from "../../components/ui";

// The changes list's rows: a title and sub line with the Undo text button at the end, or with a plain label
// such as "Undone" or "Can't undo".

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

const undoRow: ListRowProps = {
  title: "Logged 2 eggs and toast at 08:10",
  subtitle: "08:11 · 2 entries",
  trailing: { kind: "action", label: "Undo", onPress: () => undefined },
};

describe("ListRow with a trailing action or label", () => {
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

  it("should draw the title, the sub line and an Undo button named for its row", async () => {
    await renderRow(undoRow);

    expect(screen.getByText("Logged 2 eggs and toast at 08:10")).toBeOnTheScreen();
    expect(screen.getByText("08:11 · 2 entries")).toBeOnTheScreen();
    expect(screen.getByText("Undo")).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Undo, Logged 2 eggs and toast at 08:10" }),
    ).toBeOnTheScreen();
  });

  it("should name the words on the left as one group, apart from the button", async () => {
    await renderRow(undoRow);

    expect(
      screen.getByLabelText("Logged 2 eggs and toast at 08:10, 08:11 · 2 entries"),
    ).toBeOnTheScreen();
  });

  it("should call the action once when the button is pressed", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderRow({ ...undoRow, trailing: { kind: "action", label: "Undo", onPress } });

    await user.press(screen.getByRole("button", { name: /^Undo/ }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("should not respond while the action is busy", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderRow({
      ...undoRow,
      trailing: { kind: "action", label: "Undo", onPress, busy: true },
    });

    await user.press(screen.getByRole("button", { name: /^Undo/ }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it("should draw the Undo label in the accent ink", async () => {
    await renderRow(undoRow);

    expect(screen.getByText("Undo")).toHaveStyle({ color: resolvedColor("dark", "accent-ink") });
  });

  it("should draw a label as muted words in the row's one name, with no button", async () => {
    await renderRow({
      title: "Copied 8 entries from yesterday",
      subtitle: "12:30",
      trailing: { kind: "label", label: "Undone" },
    });

    expect(screen.getByText("Undone")).toBeOnTheScreen();
    expect(screen.getByText("Undone")).toHaveStyle({ color: resolvedColor("dark", "text-muted") });
    expect(
      screen.getByLabelText("Copied 8 entries from yesterday, 12:30, Undone"),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
  });

  it("should be 60 points tall at least, as the changes board draws its rows", async () => {
    await renderRow(undoRow);

    expect(
      screen.getByLabelText("Logged 2 eggs and toast at 08:10, 08:11 · 2 entries").parent,
    ).toHaveStyle({ minHeight: 60 });
  });

  it("should set the sub line in tabular numerals, so the times line up", async () => {
    await renderRow(undoRow);

    expect(screen.getByText("08:11 · 2 entries").props.style).toMatchObject({
      fontVariant: "tabular-nums",
    });
  });

  it("should reach the 44 point touch target by hit slop around the 36 point button", async () => {
    await renderRow(undoRow);

    expect(screen.getByRole("button", { name: /^Undo/ })).toHaveProp("hitSlop", {
      top: 4,
      bottom: 4,
    });
  });

  it("should draw a muted title for a row that asks for the secondary tone", async () => {
    await renderRow({
      title: "Copied 8 entries from yesterday",
      titleTone: "secondary",
      trailing: { kind: "label", label: "Undone" },
    });

    expect(screen.getByText("Copied 8 entries from yesterday")).toHaveStyle({
      color: resolvedColor("dark", "text-secondary"),
    });
  });
});
