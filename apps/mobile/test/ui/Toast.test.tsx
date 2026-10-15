import { tabBarHeight, themes } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo, Pressable, Text } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { Toast, ToastProvider, useToast } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { ToastOptions, ToastProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

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

const schemes: ThemeScheme[] = ["dark", "light"];

function inScheme(scheme: ThemeScheme, children: React.ReactNode) {
  return <ThemeProvider fixedPreference={scheme}>{children}</ThemeProvider>;
}

function renderToast(props: Partial<ToastProps> = {}, scheme: ThemeScheme = "dark") {
  return render(inScheme(scheme, <Toast message="Entry deleted" {...props} />));
}

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// The icon is decoration, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

// A screen that shows toasts: one button for each toast it can raise.
function Screen({ toasts }: { toasts: Record<string, ToastOptions> }) {
  const { show } = useToast();
  return (
    <>
      {Object.entries(toasts).map(([name, options]) => (
        <ToastButton key={name} name={name} options={options} show={show} />
      ))}
    </>
  );
}

function ToastButton({
  name,
  options,
  show,
}: {
  name: string;
  options: ToastOptions;
  show: (options: ToastOptions) => void;
}) {
  return (
    <Pressable
      role="button"
      onPress={() => {
        show(options);
      }}
    >
      <Text>{name}</Text>
    </Pressable>
  );
}

// A screen whose Undo raises a toast of its own, as undoing a delete confirms it.
function UndoScreen() {
  const { show } = useToast();
  return (
    <ToastButton
      name="Delete"
      options={{
        message: "Entry deleted",
        actionLabel: "Undo",
        onAction: () => {
          show({ message: "Entry restored" });
        },
      }}
      show={show}
    />
  );
}

function renderProvider(toasts: Record<string, ToastOptions>) {
  return render(
    inScheme(
      "dark",
      <ToastProvider>
        <Screen toasts={toasts} />
      </ToastProvider>,
    ),
  );
}

describe("Toast", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    setReduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("what it says", () => {
    it("should announce the message with the status role", async () => {
      await renderToast();

      expect(screen.getByRole("status", { name: "Entry deleted" })).toBeOnTheScreen();
    });

    it("should draw nothing when it is not open", async () => {
      await renderToast({ open: false });

      expect(screen.queryByText("Entry deleted")).not.toBeOnTheScreen();
    });

    it("should draw one icon, which is decoration, only when it has one", async () => {
      await renderToast({ icon: "Trash2" });

      expect(drawings()).toHaveLength(1);
    });

    it("should draw no icon without one", async () => {
      await renderToast();

      expect(drawings()).toHaveLength(0);
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it.each([
      { tone: "neutral", colorName: "text-secondary" },
      { tone: "success", colorName: "success" },
      { tone: "warning", colorName: "warning" },
      { tone: "danger", colorName: "danger" },
    ] as const)(
      "should colour the icon with the $tone tone and nothing else",
      async ({ tone, colorName }) => {
        await renderToast({ icon: "Check", tone }, scheme);

        expect(drawings()[0]).toHaveProp("stroke", themes[scheme][colorName]);
      },
    );

    // The design draws the action in `--accent-ink`, which is lime in dark and the primary text colour in
    // light. The token is not in main yet, so the kit resolves it here until it lands.
    it("should draw the action as accent ink, lime in dark and the primary text in light", async () => {
      await renderToast({ actionLabel: "Undo", onAction: () => undefined }, scheme);

      expect(await screen.findByText("Undo")).toHaveStyle({
        color: resolvedColor(scheme, scheme === "dark" ? "accent" : "text-primary"),
      });
    });
  });

  describe("the action", () => {
    it("should be a button named by its label, which calls onAction", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onAction = jest.fn();
      await renderToast({ actionLabel: "Undo", onAction });

      await user.press(screen.getByRole("button", { name: "Undo" }));

      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it("should draw no button without an action label", async () => {
      await renderToast();

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });
  });

  describe("where it sits", () => {
    it("should sit above the tab bar and the safe area, with 12 points between", async () => {
      await renderToast({ bottomInset: 34 });

      // The placement has no role of its own, because the announced words are inside it.
      expect(await screen.findByTestId("toast")).toHaveStyle({
        bottom: tabBarHeight + 34 + 12,
        left: 16,
        right: 16,
      });
    });
  });

  describe("how it arrives", () => {
    it("should fade in, because the cut in from the edge waits for a motion review on a device", async () => {
      await renderToast();

      expect(getAnimatedStyle(screen.getByTestId("toast-fade"))).toMatchObject({ opacity: 0 });

      await advance(300);

      expect(getAnimatedStyle(screen.getByTestId("toast-fade"))).toMatchObject({ opacity: 1 });
    });
  });

  describe("closing itself", () => {
    it("should call onClose after 5 seconds", async () => {
      const onClose = jest.fn();
      await renderToast({ onClose });

      await advance(4999);
      expect(onClose).not.toHaveBeenCalled();

      await advance(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should close after 5 seconds even with an action, which the design card did not", async () => {
      const onClose = jest.fn();
      await renderToast({ actionLabel: "Undo", onAction: () => undefined, onClose });

      await advance(5000);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should wait for the duration it is given", async () => {
      const onClose = jest.fn();
      await renderToast({ duration: 2000, onClose });

      await advance(2000);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should never close itself without onClose", async () => {
      await renderToast();

      await advance(60000);

      expect(screen.getByText("Entry deleted")).toBeOnTheScreen();
    });

    it("should not wait on a timer once it is not open", async () => {
      const onClose = jest.fn();
      await renderToast({ open: false, onClose });

      await advance(10000);

      expect(onClose).not.toHaveBeenCalled();
    });

    it("should wait while a finger is on it and give the whole wait again when the finger lifts", async () => {
      const onClose = jest.fn();
      await renderToast({ onClose });
      const toast = screen.getByText("Entry deleted");

      await advance(3000);
      await fireEvent(toast, "touchStart");
      await advance(60000);
      expect(onClose).not.toHaveBeenCalled();

      await fireEvent(toast, "touchEnd");
      await advance(4999);
      expect(onClose).not.toHaveBeenCalled();

      await advance(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should resume when a touch is taken over, as a scroll does", async () => {
      const onClose = jest.fn();
      await renderToast({ onClose });
      const toast = screen.getByText("Entry deleted");

      await fireEvent(toast, "touchStart");
      await fireEvent(toast, "touchCancel");
      await advance(5000);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

describe("ToastProvider", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    // React Native's own Jest setup already mocks this, so its calls are cleared, not restored.
    jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear();
    setReduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should announce each toast through the accessibility service, once per show", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
    await renderProvider({ Delete: { message: "Entry deleted" } });

    await user.press(screen.getByRole("button", { name: "Delete" }));

    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("Entry deleted");
  });

  it("should announce a toast again when its words match the last one", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
    await renderProvider({ Delete: { message: "Entry deleted" } });

    await user.press(screen.getByRole("button", { name: "Delete" }));
    await user.press(screen.getByRole("button", { name: "Delete" }));

    expect(announce).toHaveBeenCalledTimes(2);
  });

  it("should keep the words readable, so a user who swipes to Undo hears what it undoes", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderProvider({
      Delete: { message: "Entry deleted", actionLabel: "Undo", onAction: () => undefined },
    });

    await user.press(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("status", { name: "Entry deleted" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
  });

  it("should show one toast at a time, a new one replacing the current one", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderProvider({
      Delete: { message: "Entry deleted" },
      Add: { message: "Added to Lunch" },
    });

    await user.press(screen.getByRole("button", { name: "Delete" }));
    await user.press(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Added to Lunch")).toBeOnTheScreen();
    expect(screen.queryByText("Entry deleted")).not.toBeOnTheScreen();
  });

  it("should close the toast after 5 seconds", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderProvider({ Delete: { message: "Entry deleted" } });
    await user.press(screen.getByRole("button", { name: "Delete" }));

    await advance(4999);
    expect(screen.getByText("Entry deleted")).toBeOnTheScreen();

    await advance(1);
    expect(screen.queryByText("Entry deleted")).not.toBeOnTheScreen();
  });

  it("should give a replacing toast its own whole wait, and not close it on the old one's timer", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderProvider({
      Delete: { message: "Entry deleted" },
      Add: { message: "Added to Lunch" },
    });
    await user.press(screen.getByRole("button", { name: "Delete" }));
    await advance(3000);
    await user.press(screen.getByRole("button", { name: "Add" }));

    await advance(3000);
    expect(screen.getByText("Added to Lunch")).toBeOnTheScreen();

    await advance(2000);
    expect(screen.queryByText("Added to Lunch")).not.toBeOnTheScreen();
  });

  it("should call the action, then close the toast", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onAction = jest.fn();
    await renderProvider({
      Delete: { message: "Entry deleted", actionLabel: "Undo", onAction },
    });
    await user.press(screen.getByRole("button", { name: "Delete" }));

    await user.press(screen.getByRole("button", { name: "Undo" }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Entry deleted")).not.toBeOnTheScreen();
  });

  it("should keep a toast that its own action raised, when the action's toast then closes", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await render(
      inScheme(
        "dark",
        <ToastProvider>
          <UndoScreen />
        </ToastProvider>,
      ),
    );
    await user.press(screen.getByRole("button", { name: "Delete" }));

    await user.press(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByText("Entry restored")).toBeOnTheScreen();
  });

  it("should close the toast and keep working when the action throws", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await renderProvider({
      Delete: {
        message: "Entry deleted",
        actionLabel: "Undo",
        onAction: () => {
          throw new Error("undo failed");
        },
      },
      Add: { message: "Added to Lunch" },
    });
    await user.press(screen.getByRole("button", { name: "Delete" }));

    await expect(user.press(screen.getByRole("button", { name: "Undo" }))).rejects.toThrow(
      "undo failed",
    );
    await advance(0);
    expect(screen.queryByText("Entry deleted")).not.toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Added to Lunch")).toBeOnTheScreen();
  });

  it("should refuse useToast outside a provider", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(render(<Screen toasts={{}} />)).rejects.toThrow(
      "useToast must be used inside a ToastProvider",
    );
  });
});
