import { BODY_COMPOSITION } from "@keylow/core/copy";
import { render, screen, userEvent, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyCompositionPrompt } from "../../components/BodyCompositionPrompt";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { BodyCompositionPromptProps } from "../../components/BodyCompositionPrompt";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const onPress = jest.fn<undefined, []>();

async function renderPrompt(props: BodyCompositionPromptProps) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <BodyCompositionPrompt {...props} />
    </ThemeProvider>,
  );
}

describe("BodyCompositionPrompt variants", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/BodyCompositionPrompt"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(() => {
    onPress.mockReset();
  });

  describe("not-allowed", () => {
    const words = BODY_COMPOSITION.notAllowed;
    const props: BodyCompositionPromptProps = {
      variant: "not-allowed",
      title: words.title,
      text: words.text,
      action: words.action,
      onAction: onPress,
    };

    it("should show its title, its text and the action", async () => {
      await renderPrompt(props);

      expect(screen.getByText(words.title)).toBeOnTheScreen();
      expect(screen.getByText(words.text)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: words.action })).toBeOnTheScreen();
    });

    it("should call the action when it is pressed", async () => {
      await renderPrompt(props);

      await userEvent.setup().press(screen.getByRole("button", { name: words.action }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should give the action a 44 point target", async () => {
      await renderPrompt(props);

      expect(screen.getByRole("button", { name: words.action })).toHaveStyle({ minHeight: 44 });
    });

    it("should not be an alert", async () => {
      await renderPrompt(props);

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("no-readings-yet", () => {
    const words = BODY_COMPOSITION.noReadings;

    it("should show its title and text and offer no action", async () => {
      await renderPrompt({ variant: "no-readings-yet", title: words.title, text: words.text });

      expect(screen.getByText(words.title)).toBeOnTheScreen();
      expect(screen.getByText(words.text)).toBeOnTheScreen();
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });
  });

  describe("error", () => {
    const words = BODY_COMPOSITION.error;
    const props: BodyCompositionPromptProps = {
      variant: "error",
      title: words.title,
      text: words.body,
      retry: words.retry,
      onRetry: onPress,
    };

    it("should be an alert named by its title and text", async () => {
      await renderPrompt(props);

      const alert = screen.getByRole("alert", { name: new RegExp(words.title) });

      expect(within(alert).getByText(words.body)).toBeOnTheScreen();
    });

    it("should offer Try again as a button outside the alert's words, with a 44 point target", async () => {
      await renderPrompt(props);

      const retry = screen.getByRole("button", { name: words.retry });

      expect(retry).toHaveStyle({ minHeight: 44 });
    });

    it("should call the retry when Try again is pressed", async () => {
      await renderPrompt(props);

      await userEvent.setup().press(screen.getByRole("button", { name: words.retry }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("compact", () => {
    const words = BODY_COMPOSITION.partial.lean_mass_kg;
    const props: BodyCompositionPromptProps = {
      variant: "compact",
      text: words.text,
      action: words.action,
      onAction: onPress,
    };

    it("should show its sentence and its action", async () => {
      await renderPrompt(props);

      expect(screen.getByText(words.text)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: words.action })).toBeOnTheScreen();
    });

    it("should call the action when it is pressed", async () => {
      await renderPrompt(props);

      await userEvent.setup().press(screen.getByRole("button", { name: words.action }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should give the action a 44 point target and put it on the row with the sentence", async () => {
      await renderPrompt(props);

      expect(screen.getByRole("button", { name: words.action })).toHaveStyle({ minHeight: 44 });
    });
  });
});
