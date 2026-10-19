import { render, screen, userEvent } from "@testing-library/react-native";

import { SessionRow } from "../components/SessionRow";
import { GroupedList } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { SessionRowProps } from "../components/SessionRow";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const pull: SessionRowProps = {
  weekday: "Tue",
  dayOfMonth: "13",
  title: "Pull",
  meta: "51 min · 17 sets",
  muscles: "Lats · biceps · mid traps",
  accessibilityLabel: "Pull, Tue 13 October, 51 minutes · 17 sets, open session",
  onPress: jest.fn(),
};

const push: SessionRowProps = {
  ...pull,
  weekday: "Mon",
  dayOfMonth: "12",
  title: "Push",
  accessibilityLabel: "Push, Mon 12 October, 48 minutes · 16 sets, open session",
  onPress: jest.fn(),
};

function renderRows(rows: SessionRowProps[]) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <GroupedList hidesTitle title="This week">
        {rows.map((row) => (
          <SessionRow key={row.title} {...row} />
        ))}
      </GroupedList>
    </ThemeProvider>,
  );
}

describe("SessionRow", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SessionRow"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it("should be a button named for the session, its day and its figures", async () => {
    await renderRows([pull]);

    expect(screen.getByRole("button", { name: pull.accessibilityLabel })).toBeOnTheScreen();
  });

  it("should call its handler when it is pressed, and only its own", async () => {
    const user = userEvent.setup();
    const onPressPull = jest.fn();
    const onPressPush = jest.fn();
    await renderRows([
      { ...pull, onPress: onPressPull },
      { ...push, onPress: onPressPush },
    ]);

    await user.press(screen.getByRole("button", { name: pull.accessibilityLabel }));

    expect(onPressPull).toHaveBeenCalledTimes(1);
    expect(onPressPush).not.toHaveBeenCalled();
  });

  it("should draw the date block, the title, the figures and the muscles", async () => {
    await renderRows([pull]);

    expect(screen.getByText("Tue", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText("13", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText("Pull", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText("51 min · 17 sets", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByText("Lats · biceps · mid traps", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it("should leave the muscles line out when no muscle worked", async () => {
    await renderRows([{ ...pull, muscles: null }]);

    expect(screen.queryByText(/mid traps/, { includeHiddenElements: true })).toBeNull();
  });

  it("should draw a chevron at the end of the row", async () => {
    await renderRows([pull]);

    // The chevron is the one drawing in the row.
    expect(screen.root?.queryAll((node) => node.type === "RNSVGSvgView")).toHaveLength(1);
  });

  it("should be 68 tall at least, with 12 at the sides and 8 above and below", async () => {
    await renderRows([pull]);

    expect(screen.getByRole("button", { name: pull.accessibilityLabel })).toHaveStyle({
      minHeight: 68,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 8,
      paddingBottom: 8,
      columnGap: 12,
    });
  });

  it("should draw the date block 40 wide and 44 tall on the raised surface, with the small radius", async () => {
    await renderRows([pull]);

    expect(screen.getByText("Tue", { includeHiddenElements: true }).parent).toHaveStyle({
      width: 40,
      height: 44,
      borderRadius: 6,
    });
  });

  it("should draw a hairline above every row but the first", async () => {
    await renderRows([pull, push]);

    expect(screen.getByRole("button", { name: pull.accessibilityLabel })).not.toHaveStyle({
      borderTopWidth: 1,
    });
    expect(screen.getByRole("button", { name: push.accessibilityLabel })).toHaveStyle({
      borderTopWidth: 1,
    });
  });
});
