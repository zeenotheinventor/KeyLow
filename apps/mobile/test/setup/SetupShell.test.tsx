import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { Text } from "react-native";

import { SetupShell } from "../../components/SetupScreen/SetupShell";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { expectAccessibleNamesInOrder } from "../support/namesInOrder";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { SetupShellProps } from "../../components/SetupScreen/SetupShell";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

const baseProps: SetupShellProps = {
  title: "About you",
  subtitle: "Step 1 of 8",
  progressName: "Step 1 of 8",
  progressPercent: 11.11,
  question: "What is your sex?",
  helper: "Ki-Lo uses it with your age, height and weight to estimate the energy you use each day.",
  continueAction: { isEnabled: true, onPress: () => undefined },
};

async function renderShell(props: Partial<SetupShellProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <SetupShell {...baseProps} {...props}>
        <Text>The controls of the step</Text>
      </SetupShell>
    </ThemeProvider>,
  );
}

describe("SetupShell", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetupScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("the header", () => {
    it("should title the step with its group and say which step it is", async () => {
      await renderShell();

      expect(screen.getByRole("heading", { name: "About you" })).toBeOnTheScreen();
      expect(screen.getByText("Step 1 of 8")).toBeOnTheScreen();
    });

    it("should have no Back and no Close when the step has neither", async () => {
      await renderShell();

      expect(screen.queryByRole("button", { name: "Back" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeOnTheScreen();
    });

    it("should have Back on the left and Close on the right when it has both", async () => {
      await renderShell({ onBack: () => undefined, onClose: () => undefined });

      expectAccessibleNamesInOrder(screen.getAllByRole("button"), ["Back", "Close", "Continue"]);
    });

    it("should call onBack when Back is pressed", async () => {
      const onBack = jest.fn();
      const user = userEvent.setup();
      await renderShell({ onBack });

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when Close is pressed", async () => {
      const onClose = jest.fn();
      const user = userEvent.setup();
      await renderShell({ onClose });

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("a header that is inert", () => {
    it("should dim Back and Close and ignore a press on either", async () => {
      const onBack = jest.fn();
      const onClose = jest.fn();
      const user = userEvent.setup();
      await renderShell({ onBack, onClose, isHeaderInert: true });

      await user.press(screen.getByRole("button", { name: "Back" }));
      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
      expect(onBack).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("the progress bar", () => {
    it("should be named for the step and filled to the percentage it is given", async () => {
      await renderShell();

      expect(screen.getByRole("progressbar", { name: "Step 1 of 8" })).toHaveProp(
        "aria-valuenow",
        11,
      );
    });
  });

  describe("the body", () => {
    it("should draw the question as a heading with its helper line, then the step's controls", async () => {
      await renderShell();

      expect(screen.getByRole("heading", { name: "What is your sex?" })).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Ki-Lo uses it with your age, height and weight to estimate the energy you use each day.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText("The controls of the step")).toBeOnTheScreen();
    });

    it("should draw no question for a step that has none", async () => {
      await renderShell({ question: undefined, helper: undefined });

      expect(screen.queryByRole("heading", { name: "What is your sex?" })).not.toBeOnTheScreen();
    });
  });

  describe("the footer", () => {
    it("should call onPress when Continue is live and pressed", async () => {
      const onPress = jest.fn();
      const user = userEvent.setup();
      await renderShell({ continueAction: { isEnabled: true, onPress } });

      await user.press(screen.getByRole("button", { name: "Continue" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should announce Continue as disabled and ignore a press until the step is valid", async () => {
      const onPress = jest.fn();
      const user = userEvent.setup();
      await renderShell({ continueAction: { isEnabled: false, onPress } });

      const continueButton = screen.getByRole("button", { name: "Continue" });
      await user.press(continueButton);

      expect(continueButton).toBeDisabled();
      expect(onPress).not.toHaveBeenCalled();
    });

    it("should draw no footer when the step has no Continue", async () => {
      await renderShell({ continueAction: undefined });

      expect(screen.queryByRole("button", { name: "Continue" })).not.toBeOnTheScreen();
    });
  });

  describe("a footer the step brings", () => {
    it("should draw it in the footer in place of Continue", async () => {
      await renderShell({ continueAction: undefined, footer: <Text>The footer of the step</Text> });

      expect(screen.getByText("The footer of the step")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Continue" })).not.toBeOnTheScreen();
    });
  });

  describe("the layout the board draws", () => {
    it("should pad the body 20 above, 16 across and 16 below, with 16 between the question and the controls", async () => {
      await renderShell();

      // The scroll view's content is styled through its own prop, which is no host view's style.
      const [scrollView] =
        screen.root?.queryAll((node) => node.props.contentContainerStyle !== undefined) ?? [];
      expect(scrollView?.props.contentContainerStyle).toMatchObject({
        paddingTop: 20,
        paddingBottom: 16,
        paddingLeft: 16,
        paddingRight: 16,
        rowGap: 16,
      });
    });

    it("should draw the footer on the sheet surface under a hairline border, 16 above and 12 between its parts", async () => {
      await renderShell();

      expect(
        viewsDrawn({
          backgroundColor: resolvedColor("dark", "surface-sheet"),
          borderTopWidth: 1,
          borderColor: resolvedColor("dark", "border"),
          paddingTop: 16,
          paddingLeft: 16,
          paddingRight: 16,
          rowGap: 12,
        }),
      ).toHaveLength(1);
    });

    it("should keep the footer 12 clear of the bottom edge when there is no inset", async () => {
      await renderShell();

      expect(viewsDrawn({ paddingTop: 16, paddingBottom: 12 })).toHaveLength(1);
    });
  });
});
