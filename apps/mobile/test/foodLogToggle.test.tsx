import { groupEntriesByHour } from "@keylow/core/diary";
import { render, screen, userEvent } from "@testing-library/react-native";

import { FoodLog } from "../components/DiaryScreen/FoodLog";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { FoodLogProps } from "../components/DiaryScreen/FoodLog";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

const slash = () => screen.queryByTestId("day-complete-slash", { includeHiddenElements: true });

function logElement(props: Partial<FoodLogProps>) {
  return (
    <ThemeProvider fixedPreference="dark">
      <FoodLog
        currentHour={11}
        hours={groupEntriesByHour([], "Europe/London")}
        isComplete={false}
        isCopying={false}
        isOnline
        isToday
        isYesterdayEmpty={false}
        timeZone="Europe/London"
        onAddFood={() => undefined}
        onCompleteChange={() => Promise.resolve()}
        onCopyYesterday={() => undefined}
        onDeleteEntry={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

describe("the day complete switch in the food log", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DiaryScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it("should ask for the state it would move to when it is pressed", async () => {
    const user = userEvent.setup();
    const onCompleteChange = jest.fn(() => Promise.resolve());
    await render(logElement({ onCompleteChange }));

    await user.press(screen.getByRole("switch"));

    expect(onCompleteChange).toHaveBeenCalledTimes(1);
    expect(onCompleteChange).toHaveBeenCalledWith(true);
  });

  // The control: a press that the day then answers plays the moment.
  it("should play the moment when the day becomes complete after a press", async () => {
    const user = userEvent.setup();
    const view = await render(logElement({}));
    await user.press(screen.getByRole("switch"));

    await view.rerender(logElement({ isComplete: true }));

    expect(slash()).toBeOnTheScreen();
  });

  // A press the day never answered, because the save failed, must not stay armed: the next sync of the day
  // to complete, from another device say, would play the moment with nobody having pressed.
  it("should not play the moment for a later sync of the day after a press whose save failed", async () => {
    const user = userEvent.setup();
    const view = await render(
      logElement({ onCompleteChange: () => Promise.reject(new Error("Not saved")) }),
    );
    await user.press(screen.getByRole("switch"));
    await screen.findByRole("switch");

    await view.rerender(logElement({ isComplete: true }));

    expect(slash()).not.toBeOnTheScreen();
  });
});
