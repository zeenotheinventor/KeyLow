import { act, render, screen, userEvent } from "@testing-library/react-native";

import { WeighInRow } from "../../components/WeightScreen/WeighInRow";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { pressTwiceInTheSameMoment } from "../support/sameTickPress";
import { manualWeighIn } from "../support/weighInSheetHarness";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// A new element each time, so a rerender is not skipped for being the same one.
const element = () => (
  <ThemeProvider fixedPreference="dark">
    <WeighInRow isLeftOut={false} today="2026-10-17" weighIn={manualWeighIn} />
  </ThemeProvider>
);

const row = () => screen.getByRole("button", { name: /81\.4 kg$/ });
const ENTRY = `/more/weight/entry?id=${manualWeighIn.id}`;

describe("a row of the Weight list, pressed", () => {
  beforeEach(() => {
    resetRouterMock();
  });

  it("should open the sheet for its weigh-in", async () => {
    const user = userEvent.setup();
    await render(element());

    await user.press(row());

    expect(routerMock.push).toHaveBeenCalledWith(ENTRY);
    expect(routerMock.push).toHaveBeenCalledTimes(1);
  });

  it("should open the sheet once for a double tap", async () => {
    await render(element());

    await pressTwiceInTheSameMoment(row());

    expect(routerMock.push).toHaveBeenCalledTimes(1);
  });

  it("should open the sheet again once the screen is back in front", async () => {
    await render(element());
    await pressTwiceInTheSameMoment(row());

    routerMock.isFocused = false;
    await screen.rerender(element());
    routerMock.isFocused = true;
    await screen.rerender(element());
    await act(() => undefined);
    await pressTwiceInTheSameMoment(row());

    expect(routerMock.push).toHaveBeenCalledTimes(2);
  });
});
