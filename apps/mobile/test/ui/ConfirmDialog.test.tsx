import { borderRadius, controlHeight, themes } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ConfirmDialog } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { ConfirmDialogProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const sessionBody =
  "The 8 sets you logged in Legs today are removed from your history and your body map. This cannot be undone.";

function dialogElement(props: Partial<ConfirmDialogProps> = {}, scheme: ThemeScheme = "dark") {
  return (
    <ThemeProvider fixedPreference={scheme}>
      <ConfirmDialog
        open
        body={sessionBody}
        cancelLabel="Keep logging"
        confirmLabel="Discard session"
        title="Discard this session?"
        tone="destructive"
        onCancel={() => undefined}
        onConfirm={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

function renderDialog(props: Partial<ConfirmDialogProps> = {}, scheme: ThemeScheme = "dark") {
  return render(dialogElement(props, scheme));
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// The dim behind the dialog is a pressable that a screen reader never reaches, so it is the one button that
// only shows up when the hidden are included.
function dim() {
  const reachable = screen.getAllByRole("button");
  const hidden = screen
    .getAllByRole("button", { includeHiddenElements: true })
    .filter((button) => !reachable.includes(button));
  const [onlyButton] = hidden;
  if (hidden.length !== 1 || onlyButton === undefined) {
    throw new Error(`Expected one hidden button, the dim, and found ${hidden.length}`);
  }
  return onlyButton;
}

describe("ConfirmDialog", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    // React Native's own Jest setup already mocks this, so its calls are cleared, not restored.
    jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("what it says", () => {
    it("should be a modal alert dialog named by its title, with the title as a heading", async () => {
      await renderDialog();

      // The dialog is not one accessible element, or its buttons would be unreachable, so it is found by its name.
      const dialog = screen.getByLabelText("Discard this session?");
      expect(dialog).toHaveProp("role", "alertdialog");
      expect(dialog).toHaveProp("aria-modal", true);
      expect(screen.getByRole("heading", { name: "Discard this session?" })).toBeOnTheScreen();
    });

    it("should say its sentence under the title", async () => {
      await renderDialog();

      expect(screen.getByText(sessionBody)).toBeOnTheScreen();
    });

    it("should draw the confirm button first and the cancel button second", async () => {
      await renderDialog();

      const buttons = screen.getAllByRole("button");

      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toBe(screen.getByRole("button", { name: "Discard session" }));
      expect(buttons[1]).toBe(screen.getByRole("button", { name: "Keep logging" }));
    });

    it("should draw nothing while it is closed", async () => {
      await renderDialog({ open: false });

      expect(screen.queryByLabelText("Discard this session?")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Discard session" })).not.toBeOnTheScreen();
    });
  });

  describe.each<ThemeScheme>(["dark", "light"])("in the %s scheme", (scheme) => {
    it("should draw a card on the sheet surface, padded 20 with 12 between its parts", async () => {
      await renderDialog({}, scheme);

      expect(await screen.findByLabelText("Discard this session?")).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "surface-sheet"),
        borderColor: resolvedColor(scheme, "border"),
        borderWidth: 1,
        padding: 20,
        rowGap: 12,
      });
    });

    it("should write the title and the sentence at the start of the line", async () => {
      await renderDialog({}, scheme);

      expect(await screen.findByText(sessionBody)).not.toHaveStyle({ textAlign: "center" });
      expect(screen.getByText("Discard this session?")).not.toHaveStyle({ textAlign: "center" });
    });

    it("should keep 24 points between the card and the sides of the screen", async () => {
      await renderDialog({}, scheme);

      expect((await screen.findByLabelText("Discard this session?")).parent).toHaveStyle({
        paddingLeft: 24,
        paddingRight: 24,
      });
    });

    it("should round the card by the large radius", async () => {
      await renderDialog({}, scheme);

      expect(await screen.findByLabelText("Discard this session?")).toHaveStyle({
        borderRadius: Number.parseInt(borderRadius.large, 10),
      });
    });

    it("should dim the screen behind it with the overlay colour", async () => {
      await renderDialog({}, scheme);
      await screen.findByLabelText("Discard this session?");

      expect(dim()).toHaveStyle({
        backgroundColor: themes[scheme].overlay,
      });
    });

    it("should draw both buttons at the medium control height, 44 points", async () => {
      await renderDialog({}, scheme);

      expect(await screen.findByRole("button", { name: "Discard session" })).toHaveStyle({
        height: controlHeight.md,
      });
      expect(screen.getByRole("button", { name: "Keep logging" })).toHaveStyle({
        height: controlHeight.md,
      });
    });

    describe("for the destructive tone", () => {
      it("should write the confirm button in the danger colour on the secondary fill and border", async () => {
        await renderDialog({ tone: "destructive" }, scheme);

        expect(await screen.findByRole("button", { name: "Discard session" })).toHaveStyle({
          backgroundColor: resolvedColor(scheme, "surface-raised"),
          borderColor: resolvedColor(scheme, "border"),
          borderWidth: 1,
        });
        expect(screen.getByText("Discard session")).toHaveStyle({
          color: resolvedColor(scheme, "danger"),
        });
      });

      it("should draw the cancel button as the main one, in the accent fill", async () => {
        await renderDialog({ tone: "destructive" }, scheme);

        expect(await screen.findByRole("button", { name: "Keep logging" })).toHaveStyle({
          backgroundColor: resolvedColor(scheme, "accent"),
        });
      });
    });

    describe("for the primary tone", () => {
      const labels = { confirmLabel: "Make active", cancelLabel: "Cancel" } as const;

      it("should draw the confirm button as the main one, in the accent fill", async () => {
        await renderDialog({ tone: "primary", ...labels }, scheme);

        expect(await screen.findByRole("button", { name: "Make active" })).toHaveStyle({
          backgroundColor: resolvedColor(scheme, "accent"),
        });
      });

      it("should draw the cancel button as a secondary one", async () => {
        await renderDialog({ tone: "primary", ...labels }, scheme);

        expect(await screen.findByRole("button", { name: "Cancel" })).toHaveStyle({
          backgroundColor: resolvedColor(scheme, "surface-raised"),
        });
      });
    });
  });

  describe("where a screen reader starts", () => {
    it("should move to the title when the dialog opens", async () => {
      const sendEvent = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
      await renderDialog();

      expect(sendEvent).toHaveBeenCalledTimes(1);
      expect(sendEvent).toHaveBeenCalledWith(expect.anything(), "focus");
    });

    it("should not move anywhere while it is closed", async () => {
      const sendEvent = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
      await renderDialog({ open: false });

      expect(sendEvent).not.toHaveBeenCalled();
    });
  });

  describe("confirming", () => {
    it("should call onConfirm once, and not onCancel, when the confirm button is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      await renderDialog({ onConfirm, onCancel });

      await user.press(screen.getByRole("button", { name: "Discard session" }));
      await advance(1000);

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it("should mark the confirm button busy and name it by its label while busy", async () => {
      await renderDialog({ busy: true });

      expect(screen.getByRole("button", { name: /Discard session/, busy: true })).toBeOnTheScreen();
    });

    it("should ignore a press on the confirm button while busy, however often it is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onConfirm = jest.fn();
      await renderDialog({ busy: true, onConfirm });

      await user.press(screen.getByRole("button", { name: /Discard session/ }));
      await user.press(screen.getByRole("button", { name: /Discard session/ }));
      await advance(1000);

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("should confirm again once it is no longer busy", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onConfirm = jest.fn();
      const view = await renderDialog({ busy: true, onConfirm });
      await view.rerender(dialogElement({ busy: false, onConfirm }));

      await user.press(screen.getByRole("button", { name: "Discard session" }));
      await advance(1000);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancelling", () => {
    it("should call onCancel once, and not onConfirm, when the cancel button is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      await renderDialog({ onConfirm, onCancel });

      await user.press(screen.getByRole("button", { name: "Keep logging" }));
      await advance(1000);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("should call onCancel, and not onConfirm, when the dim behind it is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      await renderDialog({ onConfirm, onCancel });

      await user.press(dim());
      await advance(1000);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("should call onCancel on the screen reader's escape gesture", async () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      await renderDialog({ onConfirm, onCancel });

      await fireEvent(screen.getByLabelText("Discard this session?"), "accessibilityEscape");

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("should call onCancel, and not onConfirm, on the Android back button", async () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      await renderDialog({ onConfirm, onCancel });

      // The modal asks to close when the back button is pressed, and the event reaches it from inside.
      await fireEvent(screen.getByLabelText("Discard this session?"), "requestClose");

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("should not call onCancel when the screen closes it itself after a confirm", async () => {
      const onCancel = jest.fn();
      const view = await renderDialog({ onCancel });

      await view.rerender(dialogElement({ open: false, onCancel }));
      await advance(1000);

      expect(onCancel).not.toHaveBeenCalled();
    });
  });
});
