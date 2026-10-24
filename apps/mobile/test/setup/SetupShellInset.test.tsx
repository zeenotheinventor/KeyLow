import { cleanup, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SetupShell } from "../../components/SetupScreen/SetupShell";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const frame = { x: 0, y: 0, width: 390, height: 844 };

async function renderShellWithInsets(insets: { top: number; bottom: number }) {
  await render(
    <SafeAreaProvider initialMetrics={{ frame, insets: { ...insets, left: 0, right: 0 } }}>
      <ThemeProvider fixedPreference="dark">
        <SetupShell
          continueAction={{ isEnabled: true, onPress: () => undefined }}
          progressName="Step 1 of 8"
          progressPercent={11.11}
          subtitle="Step 1 of 8"
          title="About you"
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe("SetupShell on a phone with insets", () => {
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

  it("should put the footer 42 above the bottom edge on a 34 point inset, the inset and the board's 8", async () => {
    await renderShellWithInsets({ top: 47, bottom: 34 });

    expect(viewsDrawn({ paddingTop: 16, paddingBottom: 42 })).toHaveLength(1);
  });

  it("should put the whole screen under a top inset of 47", async () => {
    await renderShellWithInsets({ top: 47, bottom: 34 });

    expect(viewsDrawn({ paddingTop: 47, backgroundColor: "rgba(11, 14, 19, 1)" })).toHaveLength(1);
  });
});
