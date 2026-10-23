import { render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyMapHint } from "../../components/BodyMapHint";
import { ThemeProvider } from "../../lib/theme";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

async function renderHint(onDismiss = jest.fn()) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <BodyMapHint onDismiss={onDismiss} />
    </ThemeProvider>,
  );
  return onDismiss;
}

describe("BodyMapHint", () => {
  it("should say to long-press a muscle for details, as a status", async () => {
    await renderHint();

    expect(screen.getByRole("status")).toHaveTextContent("Long-press a muscle for details");
  });

  it("should call onDismiss when Got it is pressed", async () => {
    const onDismiss = await renderHint();

    await userEvent.press(screen.getByRole("button", { name: "Got it" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("should not call onDismiss until Got it is pressed", async () => {
    const onDismiss = await renderHint();

    await userEvent.press(screen.getByRole("status"));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
