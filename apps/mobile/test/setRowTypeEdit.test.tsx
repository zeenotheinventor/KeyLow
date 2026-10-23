import { describeSetRow } from "@keylow/core/copy";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { SetRow } from "../components/SetRow";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { SetRowTypeEdit } from "../components/SetRow";
import type { SetRowState } from "@keylow/core/training";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const SET_TYPE_BUTTON = "Set type, leg press set 3";

function renderRow(state: SetRowState, typeEdit?: SetRowTypeEdit) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <SetRow
        copy={describeSetRow({
          setType: "working",
          setNumber: 3,
          unit: "kg",
          previous: { loadKg: 170, reps: 10 },
          entry:
            state === "done"
              ? { state: "logged", loadKg: 180, reps: 11, rir: 1 }
              : { state: "empty" },
        })}
        setType="working"
        state={state}
        typeEdit={typeEdit}
      />
    </ThemeProvider>,
  );
}

describe("the mark of a set row as a button", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetRow"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should be a button named for the set type when a logged row is given what it does", async () => {
    await renderRow("done", { name: SET_TYPE_BUTTON, onPress: jest.fn() });

    expect(screen.getByRole("button", { name: SET_TYPE_BUTTON })).toBeOnTheScreen();
    expect(screen.getByText("3")).toBeOnTheScreen();
  });

  it("should do what it is given when it is pressed", async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    await renderRow("done", { name: SET_TYPE_BUTTON, onPress });

    await user.press(screen.getByRole("button", { name: SET_TYPE_BUTTON }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("should reach the 44 point touch target through its hit slop", async () => {
    await renderRow("done", { name: SET_TYPE_BUTTON, onPress: jest.fn() });

    expect(screen.getByRole("button", { name: SET_TYPE_BUTTON })).toHaveProp("hitSlop", 6);
  });

  it("should stay plain text on a logged row that is given nothing", async () => {
    await renderRow("done");

    expect(screen.queryByRole("button", { name: SET_TYPE_BUTTON })).not.toBeOnTheScreen();
    expect(screen.getByText("3")).toBeOnTheScreen();
  });
});
