import { HEALTH_ACCESS, HEALTH_ACCESS_POINTS, describeImportedCount } from "@keylow/core/copy";
import { elevation } from "@keylow/tokens";
import { render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { HealthAccessView } from "../../components/HealthAccessScreen";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { HealthAccessStep } from "../../components/HealthAccessScreen";

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

const handlers = {
  onClose: jest.fn<undefined, []>(),
  onPrimary: jest.fn<undefined, []>(),
  onSecondary: jest.fn<undefined, []>(),
  onOpenPrivacyPolicy: jest.fn<undefined, []>(),
};

async function renderStep(step: HealthAccessStep, importedCount = 64) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <HealthAccessView {...handlers} importedCount={importedCount} step={step} />
    </ThemeProvider>,
  );
}

// The numbered steps are list items in order, each holding its sentence after its number.
function expectSteps(steps: readonly string[]) {
  const items = screen.getAllByRole("listitem");

  expect(items).toHaveLength(steps.length);
  steps.forEach((sentence, index) => {
    expect(items.at(index)).toHaveTextContent(`${index + 1}.${sentence}`);
  });
}

// The header's X is named Close too, so the footer's Close is the second.
function footerClose() {
  const button = screen.getAllByRole("button", { name: "Close" })[1];
  if (button === undefined) {
    throw new Error("The screen has no footer Close button");
  }
  return button;
}

describe("HealthAccessView", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.values(handlers).forEach((handler) => handler.mockReset());
  });

  describe("explain", () => {
    it("should show the heading, the body and the Continue and Not now buttons", async () => {
      await renderStep("explain");

      expect(
        screen.getByRole("heading", { name: HEALTH_ACCESS.explain.heading }),
      ).toBeOnTheScreen();
      expect(screen.getByText(HEALTH_ACCESS.explain.body)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Continue" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Not now" })).toBeOnTheScreen();
    });

    it("should say what is read and why in the four points", async () => {
      await renderStep("explain");

      expect(HEALTH_ACCESS_POINTS.map((point) => point.title)).toEqual([
        "What Ki-Lo reads",
        "Why",
        "What it never does",
        "When",
      ]);
      HEALTH_ACCESS_POINTS.forEach((point) => {
        expect(screen.getByText(point.title)).toBeOnTheScreen();
        expect(screen.getByText(point.text)).toBeOnTheScreen();
      });
    });

    it("should open the privacy policy from its link", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderStep("explain");

      await user.press(screen.getByRole("link", { name: "Read the privacy policy" }));

      expect(handlers.onOpenPrivacyPolicy).toHaveBeenCalledTimes(1);
    });

    it("should close from the Close button in the header and from Not now", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderStep("explain");

      await user.press(screen.getByRole("button", { name: "Close" }));
      await user.press(screen.getByRole("button", { name: "Not now" }));

      expect(handlers.onClose).toHaveBeenCalledTimes(1);
      expect(handlers.onSecondary).toHaveBeenCalledTimes(1);
    });

    it("should call the primary handler from Continue", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderStep("explain");

      await user.press(screen.getByRole("button", { name: "Continue" }));

      expect(handlers.onPrimary).toHaveBeenCalledTimes(1);
    });
  });

  describe("install", () => {
    it("should show the heading, the body, the three steps and the two buttons", async () => {
      await renderStep("install");

      expect(
        screen.getByRole("heading", { name: HEALTH_ACCESS.install.heading }),
      ).toBeOnTheScreen();
      expect(screen.getByText(HEALTH_ACCESS.install.body)).toBeOnTheScreen();
      expectSteps(HEALTH_ACCESS.install.steps);
      expect(screen.getByRole("button", { name: "Get Health Connect" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Not now" })).toBeOnTheScreen();
    });

    it("should not show the points or the privacy link", async () => {
      await renderStep("install");

      expect(screen.queryByText("What Ki-Lo reads")).not.toBeOnTheScreen();
      expect(screen.queryByRole("link", { name: "Read the privacy policy" })).not.toBeOnTheScreen();
    });
  });

  describe("connecting", () => {
    it("should show the heading, the body and a disabled Importing button that does nothing", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderStep("connecting");

      expect(
        screen.getByRole("heading", { name: HEALTH_ACCESS.connecting.heading }),
      ).toBeOnTheScreen();
      expect(screen.getByText(HEALTH_ACCESS.connecting.body)).toBeOnTheScreen();
      const button = screen.getByRole("button", { name: "Importing" });
      expect(button).toBeDisabled();

      await user.press(button);

      expect(handlers.onPrimary).not.toHaveBeenCalled();
    });

    it("should have no secondary button", async () => {
      await renderStep("connecting");

      expect(screen.queryByRole("button", { name: "Not now" })).not.toBeOnTheScreen();
    });
  });

  describe("denied", () => {
    it("should show the heading, the body, the three steps and the two buttons", async () => {
      await renderStep("denied");

      expect(screen.getByRole("heading", { name: HEALTH_ACCESS.denied.heading })).toBeOnTheScreen();
      expect(screen.getByText(HEALTH_ACCESS.denied.body)).toBeOnTheScreen();
      expectSteps(HEALTH_ACCESS.denied.steps);
      expect(screen.getByRole("button", { name: "Open Health Connect" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Not now" })).toBeOnTheScreen();
    });
  });

  describe("import-error", () => {
    it("should show the heading, the body as an alert, Try again and Close", async () => {
      await renderStep("import-error");

      expect(
        screen.getByRole("heading", { name: HEALTH_ACCESS.importError.heading }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("alert")).toHaveTextContent(HEALTH_ACCESS.importError.body);
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
      // The header's X is named Close too, so the footer's Close is the second.
      expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(2);
    });

    it("should call the secondary handler from the footer Close", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderStep("import-error");

      await user.press(footerClose());

      expect(handlers.onSecondary).toHaveBeenCalledTimes(1);
    });
  });

  describe("connected", () => {
    it("should show the count as the heading, the body and See your trend", async () => {
      await renderStep("connected", 5);

      expect(screen.getByRole("heading", { name: "5 weigh-ins imported" })).toBeOnTheScreen();
      expect(screen.getByText(HEALTH_ACCESS.connected.body)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "See your trend" })).toBeOnTheScreen();
    });

    it("should read zero as the heading for a repeat import", async () => {
      await renderStep("connected", 0);

      expect(screen.getByRole("heading", { name: describeImportedCount(0) })).toHaveTextContent(
        "0 weigh-ins imported",
      );
    });
  });

  it.each<HealthAccessStep>([
    "explain",
    "install",
    "connecting",
    "denied",
    "import-error",
    "connected",
  ])("should not mention Apple or HealthKit in the %s state", async (step) => {
    await renderStep(step);

    expect(screen.root).not.toHaveTextContent(/apple|healthkit/i);
  });

  it("should not show an alert in the states that are not an error", async () => {
    await renderStep("denied");

    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });
});

describe("the points card of the explain state", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should be a bordered surface with no elevation, as the board draws it", async () => {
    await renderStep("explain");

    const [firstPoint] = screen.getAllByRole("listitem");

    expect(firstPoint?.parent).toHaveStyle({ borderWidth: 1, overflow: "hidden" });
    expect(firstPoint?.parent).not.toHaveStyle({ boxShadow: elevation.dark.card });
  });
});
