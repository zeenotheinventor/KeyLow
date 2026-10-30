import { cleanup, render, screen } from "@testing-library/react-native";

import { PriorityRow } from "../../components/GoalQuestionnaire";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { PriorityRowProps } from "../../components/GoalQuestionnaire";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// A host node's props are loosely typed, so a prop is read with a descriptor.
function propOf(props: object, name: string): unknown {
  return Object.getOwnPropertyDescriptor(props, name)?.value;
}

function styleProperty(style: unknown, name: string): unknown {
  if (Array.isArray(style)) {
    return style.map((part) => styleProperty(part, name)).findLast((value) => value !== undefined);
  }
  return typeof style === "object" && style !== null ? propOf(style, name) : undefined;
}

async function renderRow(props: PriorityRowProps) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <PriorityRow {...props} />
    </ThemeProvider>,
  );
}

describe("PriorityRow", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/GoalQuestionnaire"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should show the title and the description", async () => {
    await renderRow({
      group: "first",
      title: "Side delts come first",
      detail: "Suggestions fill them before anything else.",
    });

    expect(screen.getByText("Side delts come first")).toBeOnTheScreen();
    expect(screen.getByText("Suggestions fill them before anything else.")).toBeOnTheScreen();
  });

  it("should show only the title when there is no description", async () => {
    await renderRow({ group: "notTargeted", title: "Obliques get no direct work", detail: null });

    expect(screen.getByText("Obliques get no direct work")).toBeOnTheScreen();
    expect(screen.queryByText("Suggestions fill them before anything else.")).not.toBeOnTheScreen();
  });

  it.each([
    ["first", "volume-productive"],
    ["keptUp", "volume-maintaining"],
    ["notTargeted", "volume-not-trained"],
    ["fit", "text-muted"],
  ] as const)(
    "should colour the swatch of the %s group with the %s token",
    async (group, token) => {
      await renderRow({ group, title: "A row", detail: null });

      const swatches = screen.root?.queryAll(
        (node) =>
          typeof node.type === "string" &&
          styleProperty(node.props.style, "width") === 10 &&
          styleProperty(node.props.style, "height") === 10,
      );
      expect(swatches).toHaveLength(1);
      expect(styleProperty(swatches?.[0]?.props.style, "backgroundColor")).toBe(
        resolvedColor("dark", token),
      );
    },
  );

  it("should keep the swatch out of the reading of the row, since the words carry the same information", async () => {
    await renderRow({ group: "first", title: "A row", detail: null });

    expect(screen.getByText("A row")).toBeOnTheScreen();
    expect(
      screen.root?.queryAll((node) => propOf(node.props, "aria-hidden") === true),
    ).not.toHaveLength(0);
  });
});
