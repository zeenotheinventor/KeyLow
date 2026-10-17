import { render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { GroupedList, ListRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { GroupedListProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

async function renderList(props: Partial<GroupedListProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <GroupedList title="Recipes" {...props}>
        <ListRow title="Beef chilli" onPress={() => undefined} />
        <ListRow title="Chicken and rice" onPress={() => undefined} />
      </GroupedList>
    </ThemeProvider>,
  );
}

describe("GroupedList with its title hidden", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should draw the title as a heading unless it is hidden", async () => {
    await renderList();

    expect(screen.getByRole("heading", { name: "Recipes" })).toBeOnTheScreen();
  });

  it("should draw no heading when the title is hidden", async () => {
    await renderList({ hidesTitle: true });

    expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
    expect(screen.queryByText("Recipes")).not.toBeOnTheScreen();
  });

  it("should still name the list by the title, so a screen reader hears what the rows are", async () => {
    await renderList({ hidesTitle: true });

    const list = screen.getByLabelText("Recipes");
    expect(list).toHaveProp("role", "list");
    expect(within(list).getAllByRole("button")).toHaveLength(2);
  });
});
