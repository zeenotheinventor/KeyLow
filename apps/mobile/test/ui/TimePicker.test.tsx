import { themes } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { useState } from "react";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { TimePicker, TimeRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

type HarnessProps = {
  initialTime?: string;
  initiallyOpen?: boolean;
  onChange?: (time: string) => void;
};

// A screen as the portion picker is: it keeps the time and whether the picker is showing, and the row
// opens the picker. What the picker hands back is what the row then reads.
function Harness({ initialTime = "12:40", initiallyOpen = false, onChange }: HarnessProps) {
  const [time, setTime] = useState(initialTime);
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <>
      <TimeRow
        open={open}
        time={time}
        onPress={() => {
          setOpen(true);
        }}
      />
      <TimePicker
        open={open}
        value={time}
        onChange={(next) => {
          setTime(next);
          onChange?.(next);
        }}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

async function renderPicker(props: HarnessProps = {}, scheme: ThemeScheme = "dark") {
  const onChange = props.onChange ?? jest.fn();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference={scheme}>
        <Harness initiallyOpen {...props} onChange={onChange} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return { user, onChange };
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

const hours = () => screen.getByRole("spinbutton", { name: "Hours" });
const minutes = () => screen.getByRole("spinbutton", { name: "Minutes" });
const chosen = (wheel: ReturnType<typeof hours>) =>
  within(wheel).getByRole("option", { selected: true });

async function adjust(wheel: ReturnType<typeof hours>, actionName: "increment" | "decrement") {
  await fireEvent(wheel, "accessibilityAction", { nativeEvent: { actionName } });
}

// The dim behind the sheet is a pressable that a screen reader never reaches, because the sheet is
// modal, so it is found among the hidden.
const backdrop = () => screen.getByRole("button", { includeHiddenElements: true, name: "" });

describe("TimePicker", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("what it shows", () => {
    it("should be a dialog titled Time with a Done button", async () => {
      await renderPicker();

      expect(screen.getByLabelText("Time")).toHaveProp("role", "dialog");
      expect(screen.getByRole("heading", { name: "Time" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Done" })).toBeOnTheScreen();
    });

    it("should draw nothing while it is closed", async () => {
      await renderPicker({ initiallyOpen: false });

      expect(screen.queryByRole("spinbutton", { name: "Hours" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Done" })).not.toBeOnTheScreen();
    });

    it("should have an Hours wheel from 00 to 23 and a Minutes wheel from 00 to 59", async () => {
      await renderPicker();

      expect(within(hours()).getAllByRole("option")).toHaveLength(24);
      expect(within(hours()).getByRole("option", { name: "00" })).toBeOnTheScreen();
      expect(within(hours()).getByRole("option", { name: "23" })).toBeOnTheScreen();
      expect(within(hours()).queryByRole("option", { name: "24" })).not.toBeOnTheScreen();
      expect(within(minutes()).getAllByRole("option")).toHaveLength(60);
      expect(within(minutes()).getByRole("option", { name: "59" })).toBeOnTheScreen();
      expect(within(minutes()).queryByRole("option", { name: "60" })).not.toBeOnTheScreen();
    });

    it.each([
      ["12:40", "12", "40"],
      ["00:00", "00", "00"],
      ["23:59", "23", "59"],
    ])("should start at %s with that hour and minute selected", async (time, hour, minute) => {
      await renderPicker({ initialTime: time });

      expect(within(chosen(hours())).getByText(hour)).toBeOnTheScreen();
      expect(within(chosen(minutes())).getByText(minute)).toBeOnTheScreen();
    });

    it("should select exactly one hour and one minute", async () => {
      await renderPicker();

      expect(within(hours()).getAllByRole("option", { selected: true })).toHaveLength(1);
      expect(within(minutes()).getAllByRole("option", { selected: true })).toHaveLength(1);
    });
  });

  describe("choosing a time", () => {
    it("should call onChange with 12:40 when 12 and 40 are chosen and Done is pressed", async () => {
      const { user, onChange } = await renderPicker({ initialTime: "09:05" });

      await user.press(within(hours()).getByRole("option", { name: "12" }));
      await user.press(within(minutes()).getByRole("option", { name: "40" }));
      await user.press(screen.getByRole("button", { name: "Done" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("12:40");
    });

    it("should close the sheet when Done is pressed, and the row read the new time", async () => {
      const { user } = await renderPicker({ initialTime: "09:05" });

      await user.press(within(hours()).getByRole("option", { name: "12" }));
      await user.press(screen.getByRole("button", { name: "Done" }));
      await advance(1000);

      expect(screen.queryByRole("button", { name: "Done" })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Time, 12:05, change" })).toBeOnTheScreen();
    });

    it("should hand back the time it was opened with when Done is pressed with nothing changed", async () => {
      const { user, onChange } = await renderPicker();

      await user.press(screen.getByRole("button", { name: "Done" }));

      expect(onChange).toHaveBeenCalledWith("12:40");
    });

    it("should choose a row that is scrolled to", async () => {
      const { user, onChange } = await renderPicker({ initialTime: "09:05" });

      await fireEvent.scroll(hours(), { nativeEvent: { contentOffset: { x: 0, y: 44 * 17 } } });
      await user.press(screen.getByRole("button", { name: "Done" }));

      expect(onChange).toHaveBeenCalledWith("17:05");
    });
  });

  describe("dismissing it without Done", () => {
    it("should not call onChange when the dim is pressed, even after a choice", async () => {
      const { user, onChange } = await renderPicker({ initialTime: "09:05" });

      await user.press(within(hours()).getByRole("option", { name: "12" }));
      await user.press(backdrop());
      await advance(1000);

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Time, 09:05, change" })).toBeOnTheScreen();
    });

    it("should not call onChange on the screen reader's escape gesture", async () => {
      const { user, onChange } = await renderPicker({ initialTime: "09:05" });

      await user.press(within(minutes()).getByRole("option", { name: "30" }));
      await fireEvent(screen.getByLabelText("Time"), "accessibilityEscape");
      await advance(1000);

      expect(onChange).not.toHaveBeenCalled();
    });

    it("should discard the change, so the next opening starts from the time the row has", async () => {
      const { user } = await renderPicker({ initialTime: "09:05" });
      await user.press(within(hours()).getByRole("option", { name: "12" }));
      await user.press(backdrop());
      await advance(1000);

      await user.press(screen.getByRole("button", { name: "Time, 09:05, change" }));

      expect(within(chosen(hours())).getByText("09")).toBeOnTheScreen();
    });
  });

  describe("adjusting a wheel with a screen reader", () => {
    it("should be adjustable by increment and decrement actions", async () => {
      await renderPicker();

      for (const wheel of [hours(), minutes()]) {
        expect(wheel).toHaveProp("accessibilityActions", [
          { name: "increment" },
          { name: "decrement" },
        ]);
      }
    });

    it("should step an hour up by one on increment and down by one on decrement", async () => {
      await renderPicker({ initialTime: "12:40" });

      await adjust(hours(), "increment");
      expect(within(chosen(hours())).getByText("13")).toBeOnTheScreen();

      await adjust(hours(), "decrement");
      await adjust(hours(), "decrement");
      expect(within(chosen(hours())).getByText("11")).toBeOnTheScreen();
    });

    it("should step a minute by one and leave the hour alone", async () => {
      await renderPicker({ initialTime: "12:40" });

      await adjust(minutes(), "increment");

      expect(within(chosen(minutes())).getByText("41")).toBeOnTheScreen();
      expect(within(chosen(hours())).getByText("12")).toBeOnTheScreen();
    });

    it("should wrap the hours from 23 to 00 and from 00 to 23", async () => {
      await renderPicker({ initialTime: "23:10" });

      await adjust(hours(), "increment");
      expect(within(chosen(hours())).getByText("00")).toBeOnTheScreen();

      await adjust(hours(), "decrement");
      expect(within(chosen(hours())).getByText("23")).toBeOnTheScreen();
    });

    it("should wrap the minutes from 59 to 00 and from 00 to 59, without moving the hour", async () => {
      await renderPicker({ initialTime: "08:59" });

      await adjust(minutes(), "increment");
      expect(within(chosen(minutes())).getByText("00")).toBeOnTheScreen();
      expect(within(chosen(hours())).getByText("08")).toBeOnTheScreen();

      await adjust(minutes(), "decrement");
      expect(within(chosen(minutes())).getByText("59")).toBeOnTheScreen();
    });

    it("should give the chosen time to Done after adjusting", async () => {
      const { user, onChange } = await renderPicker({ initialTime: "23:59" });

      await adjust(hours(), "increment");
      await adjust(minutes(), "increment");
      await user.press(screen.getByRole("button", { name: "Done" }));

      expect(onChange).toHaveBeenCalledWith("00:00");
    });

    it("should say the chosen value, and the range, on each wheel", async () => {
      await renderPicker({ initialTime: "08:05" });

      expect(hours()).toHaveProp("aria-valuetext", "08");
      expect(hours()).toHaveProp("aria-valuemin", 0);
      expect(hours()).toHaveProp("aria-valuemax", 23);
      expect(minutes()).toHaveProp("aria-valuetext", "05");
      expect(minutes()).toHaveProp("aria-valuemax", 59);
    });
  });

  describe.each<ThemeScheme>(["dark", "light"])("in the %s scheme", (scheme) => {
    it("should set the chosen row on accent-muted in the accent ink", async () => {
      await renderPicker({}, scheme);

      const row = chosen(hours());
      expect(row).toHaveStyle({ backgroundColor: themes[scheme]["accent-muted"] });
      expect(within(row).getByText("12")).toHaveStyle({
        color: resolvedColor(scheme, "accent-ink"),
      });
    });

    it("should fade the neighbours of the chosen row to 80 percent and the rest to 50", async () => {
      await renderPicker({}, scheme);
      const options = within(hours()).getAllByRole("option");

      expect(options[12]).toHaveStyle({ opacity: 1 });
      expect(options[11]).toHaveStyle({ opacity: Math.fround(0.8) });
      expect(options[13]).toHaveStyle({ opacity: Math.fround(0.8) });
      expect(options[10]).toHaveStyle({ opacity: Math.fround(0.5) });
      expect(options[14]).toHaveStyle({ opacity: Math.fround(0.5) });
    });

    it("should make each row 44 high", async () => {
      await renderPicker({}, scheme);

      expect(chosen(hours())).toHaveStyle({ height: 44 });
    });
  });
});
