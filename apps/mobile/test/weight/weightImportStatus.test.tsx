import { render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import {
  WeightImportStatus,
  WeightImportingLine,
} from "../../components/WeightScreen/WeightImportStatus";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { WeightImportStatusProps } from "../../components/WeightScreen/WeightImportStatus";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const now = new Date("2026-10-23T12:00:00.000Z");
const twoMinutesAgo = "2026-10-23T11:58:00.000Z";

async function renderStatus(props: Partial<WeightImportStatusProps>) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <WeightImportStatus
        connection="connected"
        isImporting={false}
        lastImportedAt={null}
        now={now}
        onConnect={() => undefined}
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("the status beside the Weigh-ins heading", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it("should say it is checking while an import runs", async () => {
    await renderStatus({ isImporting: true, lastImportedAt: twoMinutesAgo });

    expect(screen.getByText("Checking for new readings")).toBeOnTheScreen();
    expect(screen.queryByText(/updated/)).not.toBeOnTheScreen();
  });

  it("should give the minutes since the last import when connected", async () => {
    await renderStatus({ lastImportedAt: twoMinutesAgo });

    expect(screen.getByText("Health Connect · updated 2 min ago")).toBeOnTheScreen();
  });

  it("should say nothing when connected and nothing has been imported yet", async () => {
    await renderStatus({ lastImportedAt: null });

    expect(screen.queryByText(/Health Connect/)).not.toBeOnTheScreen();
  });

  it("should never count a negative time when the clock is behind the import", async () => {
    await renderStatus({ lastImportedAt: "2026-10-23T12:05:00.000Z" });

    expect(screen.getByText("Health Connect · updated just now")).toBeOnTheScreen();
  });

  it.each(["unavailable", "checking"] as const)(
    "should say nothing when %s",
    async (connection) => {
      await renderStatus({ connection, lastImportedAt: twoMinutesAgo });

      expect(screen.queryByText(/Health Connect/)).not.toBeOnTheScreen();
    },
  );

  describe("when not connected", () => {
    it("should be a link named Connect Health Connect that opens the flow", async () => {
      const user = userEvent.setup();
      const onConnect = jest.fn();
      await renderStatus({ connection: "not-connected", onConnect });

      await user.press(screen.getByRole("link", { name: "Connect Health Connect" }));

      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it("should have a 44 point touch target", async () => {
      await renderStatus({ connection: "not-connected" });

      expect(screen.getByRole("link", { name: "Connect Health Connect" })).toHaveStyle({
        minHeight: 44,
      });
    });
  });
});

describe("the importing line", () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be a status that says it is importing from Health Connect", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <WeightImportingLine />
      </ThemeProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Importing from Health Connect");
  });
});
