import { cleanup, fireEvent, render, screen, userEvent } from "@testing-library/react-native";

import { BirthDateStep } from "../../components/SetupScreen/steps/BirthDateStep";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const TODAY = "2026-10-23";

async function renderStep({
  value,
  onChange = jest.fn(),
}: {
  value?: string;
  onChange?: (birthDate: string | undefined) => void;
} = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <BirthDateStep today={TODAY} value={value} onChange={onChange} />
    </ThemeProvider>,
  );
}

const day = () => screen.getByLabelText("Day of birth");
const month = () => screen.getByLabelText("Month of birth");
const year = () => screen.getByLabelText("Year of birth");

async function typeDate(dayText: string, monthText: string, yearText: string) {
  const user = userEvent.setup();
  await user.type(day(), dayText);
  await user.type(month(), monthText);
  // Typing ends by leaving the field unless it is told not to, and leaving the year is what some tests are about.
  await user.type(year(), yearText, { skipBlur: true });
}

const dangerBorders = () => viewsDrawn({ borderColor: resolvedColor("dark", "danger") });

describe("BirthDateStep", () => {
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

  describe("the fields", () => {
    it("should be three fields in British order, Day, Month, Year, with their placeholders", async () => {
      await renderStep();

      expect(screen.getByLabelText("Date of birth")).toHaveProp("role", "group");
      expect(day()).toHaveProp("placeholder", "DD");
      expect(month()).toHaveProp("placeholder", "MM");
      expect(year()).toHaveProp("placeholder", "YYYY");
      expect(screen.getByText("Day")).toBeOnTheScreen();
      expect(screen.getByText("Month")).toBeOnTheScreen();
      expect(screen.getByText("Year")).toBeOnTheScreen();
    });

    it("should give the year 1.6 times the room of the day and of the month", async () => {
      await renderStep();

      // NativeWind stores the grow as a 32 bit float, so the board's 1.6 reads back as its nearest one.
      expect(viewsDrawn({ flexGrow: Math.fround(1.6) })).toHaveLength(1);
    });

    it("should ask for the number pad on each field", async () => {
      await renderStep();

      for (const field of [day(), month(), year()]) {
        expect(field).toHaveProp("keyboardType", "number-pad");
      }
    });

    it("should be empty, with no error and no age, when nothing is typed", async () => {
      await renderStep();

      for (const field of [day(), month(), year()]) {
        expect(field).toHaveDisplayValue("");
      }
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(screen.queryByText(/^You are/)).not.toBeOnTheScreen();
    });

    it("should keep digits only", async () => {
      const user = userEvent.setup();
      await renderStep();

      await user.type(day(), "1a");

      expect(day()).toHaveDisplayValue("1");
    });

    it("should start from a birth date it is given", async () => {
      await renderStep({ value: "1991-03-14" });

      expect(day()).toHaveDisplayValue("14");
      expect(month()).toHaveDisplayValue("03");
      expect(year()).toHaveDisplayValue("1991");
      expect(screen.getByText("You are 35.")).toBeOnTheScreen();
    });
  });

  describe("a valid date", () => {
    it("should say how old the person is and hand the date on", async () => {
      const onChange = jest.fn();
      await renderStep({ onChange });

      await typeDate("14", "03", "1991");

      expect(screen.getByText("You are 35.")).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(onChange).toHaveBeenLastCalledWith("1991-03-14");
    });

    it("should hand on nothing again once the date stops being valid", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderStep({ value: "1991-03-14", onChange });

      await user.clear(year());

      expect(onChange).toHaveBeenLastCalledWith(undefined);
      expect(screen.queryByText("You are 35.")).not.toBeOnTheScreen();
    });
  });

  describe("a date that cannot be used", () => {
    it("should say the person must be 13 or over, border the three fields in danger and hand on nothing", async () => {
      const onChange = jest.fn();
      await renderStep({ onChange });

      await typeDate("02", "06", "2015");

      expect(screen.getByRole("alert")).toHaveTextContent(
        "You need to be 13 or over to use Ki-Lo.",
      );
      expect(dangerBorders()).toHaveLength(3);
      expect(onChange).toHaveBeenLastCalledWith(undefined);
      expect(screen.queryByText(/^You are/)).not.toBeOnTheScreen();
    });

    it("should say to enter a date before today for a future date", async () => {
      await renderStep();

      await typeDate("12", "11", "2026");

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a date before today.");
    });

    it("should say to enter a real date for 31 February", async () => {
      await renderStep();

      await typeDate("31", "02", "1991");

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a real date.");
    });

    it("should name the first year it accepts for a year that makes the person over 100", async () => {
      await renderStep();

      await typeDate("01", "01", "1900");

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a year from 1926 onwards.");
    });

    it("should describe each field by the error, as a native field says it is invalid", async () => {
      await renderStep();

      await typeDate("02", "06", "2015");

      for (const field of [day(), month(), year()]) {
        expect(field).toHaveProp("accessibilityHint", "You need to be 13 or over to use Ki-Lo.");
      }
    });
  });

  describe("when the error shows", () => {
    it("should wait until the year has four digits", async () => {
      await renderStep();

      await typeDate("02", "06", "201");

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(dangerBorders()).toHaveLength(0);
    });

    it("should show as the fourth digit of the year arrives", async () => {
      const user = userEvent.setup();
      await renderStep();
      await typeDate("02", "06", "201");

      await user.type(year(), "5", { skipBlur: true });

      expect(screen.getByRole("alert")).toBeOnTheScreen();
    });

    it("should show when the person moves on from a year that is not finished", async () => {
      await renderStep();
      await typeDate("02", "06", "20");

      await fireEvent(year(), "blur");

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a real date.");
    });

    it("should say nothing when the person leaves the year empty with nothing typed", async () => {
      await renderStep();

      await fireEvent(year(), "blur");

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("a birth date that arrives after the step opened", () => {
    const step = (value: string | undefined) => (
      <ThemeProvider fixedPreference="dark">
        <BirthDateStep today={TODAY} value={value} onChange={jest.fn()} />
      </ThemeProvider>
    );

    it("should fill the fields while nothing has been typed", async () => {
      await render(step(undefined));

      await screen.rerender(step("1991-03-14"));

      expect(day()).toHaveDisplayValue("14");
      expect(month()).toHaveDisplayValue("03");
      expect(year()).toHaveDisplayValue("1991");
    });

    it("should leave the fields alone once the person has typed in one", async () => {
      const user = userEvent.setup();
      await render(step(undefined));
      await user.type(day(), "3", { skipBlur: true });

      await screen.rerender(step("1991-03-14"));

      expect(day()).toHaveDisplayValue("3");
      expect(month()).toHaveDisplayValue("");
      expect(year()).toHaveDisplayValue("");
    });
  });
});
