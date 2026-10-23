import { HEALTH_ACCESS } from "@keylow/core/copy";
import { render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyCompositionPrompt } from "../../components/BodyCompositionPrompt";
import * as stories from "../../components/BodyCompositionPrompt/BodyCompositionPrompt.stories";
import { storyStates } from "../../components/BodyCompositionPrompt/storyStates";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const words = HEALTH_ACCESS.connectedPartial.leanMassMissing;
const onAction = jest.fn<undefined, []>();

async function renderPrompt() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <BodyCompositionPrompt action={words.action} text={words.text} onAction={onAction} />
    </ThemeProvider>,
  );
}

describe("BodyCompositionPrompt", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(() => {
    onAction.mockReset();
  });

  it("should say what was not allowed and offer its action", async () => {
    await renderPrompt();

    expect(screen.getByText(words.text)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: words.action })).toBeOnTheScreen();
  });

  it("should call the action when the text button is pressed", async () => {
    await renderPrompt();

    await userEvent.setup().press(screen.getByRole("button", { name: words.action }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("should give the text button a 44 point target", async () => {
    await renderPrompt();

    expect(screen.getByRole("button", { name: words.action })).toHaveStyle({ minHeight: 44 });
  });

  it("should have a story for each state it lists, and no other", () => {
    expect(
      Object.keys(stories)
        .filter((name) => name !== "default")
        .sort(),
    ).toEqual([...storyStates].sort());
  });
});
