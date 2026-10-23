import { BODY_MAP } from "@keylow/core/copy";
import { BODY_ARTWORK } from "@keylow/core/training";
import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { FigureSettingSheet } from "../components/FigureSettingSheet";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { FigureSettingSheetProps } from "../components/FigureSettingSheet";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

// A host node's props are loosely typed, so a prop is read with a descriptor.
function propOf(props: object, name: string): unknown {
  return Object.getOwnPropertyDescriptor(props, name)?.value;
}

const onChange = jest.fn();
const onClose = jest.fn();

async function renderSheet(props: Partial<FigureSettingSheetProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <FigureSettingSheet figure="male" open onChange={onChange} onClose={onClose} {...props} />
    </ThemeProvider>,
  );
}

describe("the figure setting sheet", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/FigureSettingSheet"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    onChange.mockClear();
    onClose.mockClear();
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should be a dialog and a heading named Figure", async () => {
    await renderSheet();

    expect(screen.getByLabelText("Figure")).toHaveProp("role", "dialog");
    expect(screen.getByRole("heading", { name: "Figure" })).toBeOnTheScreen();
  });

  it("should say that only the drawing changes", async () => {
    await renderSheet();

    expect(
      screen.getByText("This changes how the body is drawn. Nothing else changes."),
    ).toBeOnTheScreen();
  });

  it("should offer Male and Female with the figure shown chosen", async () => {
    await renderSheet({ figure: "female" });

    const choices = screen.getByLabelText("Figure: male or female");
    expect(choices).toHaveProp("role", "radiogroup");
    expect(within(choices).getByRole("radio", { name: "Female", checked: true })).toBeOnTheScreen();
    expect(within(choices).getByRole("radio", { name: "Male", checked: false })).toBeOnTheScreen();
  });

  it("should hand the figure pressed to onChange", async () => {
    const user = userEvent.setup();
    await renderSheet();

    await user.press(screen.getByRole("radio", { name: "Female" }));

    expect(onChange).toHaveBeenCalledWith("female");
  });

  it("should close from Done", async () => {
    const user = userEvent.setup();
    await renderSheet();

    await user.press(screen.getByRole("button", { name: "Done" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["male", BODY_ARTWORK.male.front.outline],
    ["female", BODY_ARTWORK.female.front.outline],
  ] as const)("should preview the %s figure", async (figure, outline) => {
    await renderSheet({ figure });

    // The preview is decoration beside the choice, which the radio buttons already name.
    const preview = screen.getByRole("img", {
      name: BODY_MAP.figureSetting.options[figure],
      hidden: true,
    });
    expect(
      preview.queryAll((node) => node.type === "RNSVGPath" && propOf(node.props, "d") === outline),
    ).toHaveLength(1);
  });

  it("should draw nothing once it is closed", async () => {
    await renderSheet({ open: false });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByLabelText("Figure")).not.toBeOnTheScreen();
  });
});
