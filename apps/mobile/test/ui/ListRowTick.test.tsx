import { themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ListRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { ListRowProps } from "../../components/ui";

// The Export my data screen's file row: a title and a sub line, with a success tick at the end that has a name
// of its own ("Ready" or "Saved").

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

// The file icon is drawn first and the tick last.
const drawings = () => screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];

async function renderRow(props: ListRowProps) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <ListRow {...props} />
    </ThemeProvider>,
  );
}

const fileRow: ListRowProps = {
  icon: "FileJson",
  title: "ki-lo-export-2026-11-04.json",
  subtitle: "1.8 MB · Ready to save",
  trailing: { kind: "tick", label: "Ready" },
};

describe("ListRow with a trailing tick", () => {
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

  it("should name the words on the left as one group, apart from the tick", async () => {
    await renderRow(fileRow);

    expect(
      screen.getByLabelText("ki-lo-export-2026-11-04.json, 1.8 MB · Ready to save"),
    ).toBeOnTheScreen();
  });

  it("should draw a tick that a screen reader can name", async () => {
    await renderRow(fileRow);

    expect(screen.getByRole("img", { name: "Ready" })).toBeOnTheScreen();
  });

  it("should name the tick for the state it shows", async () => {
    await renderRow({ ...fileRow, trailing: { kind: "tick", label: "Saved" } });

    expect(screen.getByRole("img", { name: "Saved" })).toBeOnTheScreen();
    expect(screen.queryByRole("img", { name: "Ready" })).not.toBeOnTheScreen();
  });

  it("should draw the tick in the success colour", async () => {
    await renderRow(fileRow);

    expect(drawings().at(-1)).toHaveProp("stroke", themes.dark.success);
  });

  it("should draw no button, since a tick is not an action", async () => {
    await renderRow(fileRow);

    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
  });

  it("should be 60 points tall at least, as the export board draws its file row", async () => {
    await renderRow(fileRow);

    expect(
      screen.getByLabelText("ki-lo-export-2026-11-04.json, 1.8 MB · Ready to save").parent,
    ).toHaveStyle({ minHeight: 60 });
  });
});
