import "react-native-gesture-handler/jestSetup";

import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { QuickAddForm } from "../components/QuickAddForm";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";

import type { QuickAddFormProps } from "../components/QuickAddForm";

// The quick add form as a component, the way the new quick add route and the entry screen use it: what the
// quick add boards draw, the live helper, and what Add and Save hand over. Its routes have their own tests.

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

type CreateProps = Extract<QuickAddFormProps, { mode: "create" }>;
type EditProps = Extract<QuickAddFormProps, { mode: "edit" }>;

const savedValues = { kcal: "130", protein: "2", carbs: "15", fat: "7", label: "Meal deal crisps" };

async function renderCreate(props: Partial<CreateProps> = {}) {
  const onSubmit = jest.fn();
  const onLeave = jest.fn();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <QuickAddForm
        hasSaveError={false}
        isNow
        isOnline
        isSaving={false}
        mode="create"
        time="12:40"
        onLeave={onLeave}
        onSubmit={onSubmit}
        {...props}
      />
    </ThemeProvider>,
  );
  return { user, onSubmit, onLeave };
}

async function renderEdit(props: Partial<EditProps> = {}) {
  const onSubmit = jest.fn();
  const onLeave = jest.fn();
  const onDelete = jest.fn();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <QuickAddForm
        hasSaveError={false}
        initialValues={savedValues}
        isNow={false}
        isOnline
        isSaving={false}
        mode="edit"
        time="12:45"
        onDelete={onDelete}
        onLeave={onLeave}
        onSubmit={onSubmit}
        {...props}
      />
    </ThemeProvider>,
  );
  return { user, onSubmit, onLeave, onDelete };
}

const calories = () => screen.getByLabelText("Calories (kcal)");
const protein = () => screen.getByLabelText("Protein in grams");
const carbohydrate = () => screen.getByLabelText("Carbohydrate in grams");
const fat = () => screen.getByLabelText("Fat in grams");
const label = () => screen.getByLabelText("Label (optional)");
const addButton = () => screen.getByRole("button", { name: "Add" });

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

type User = Awaited<ReturnType<typeof renderCreate>>["user"];

async function fill(user: User, field: () => ReturnType<typeof calories>, text: string) {
  await user.clear(field());
  await user.type(field(), text);
}

describe("QuickAddForm", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/QuickAddForm"]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("a new quick add", () => {
    it("should be titled Quick add, with a Close control that leaves", async () => {
      const { user, onLeave } = await renderCreate();

      expect(screen.getByRole("heading", { name: "Quick add" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Close" }));
      expect(onLeave).toHaveBeenCalledTimes(1);
    });

    it("should ask for calories, then protein, carbohydrate and fat in that order, then a label", async () => {
      await renderCreate();

      const names = screen
        .getAllByLabelText(/^(Calories|Protein|Carbohydrate|Fat|Label)/)
        .map((field) => field.props["aria-label"] as string);
      expect(names).toEqual([
        "Calories (kcal)",
        "Protein in grams",
        "Carbohydrate in grams",
        "Fat in grams",
        "Label (optional)",
      ]);
      expect(label()).toHaveProp("placeholder", "For example, meal deal crisps");
    });

    it("should say that quick adds count towards the day's totals", async () => {
      await renderCreate();

      expect(
        screen.getByText(
          'Quick adds count towards the day\'s totals and show as "Quick add" in the diary.',
        ),
      ).toBeOnTheScreen();
    });

    it("should say the macros are optional, and keep Add off, until there are calories", async () => {
      await renderCreate();

      expect(screen.getByText("Macros are optional")).toBeOnTheScreen();
      expect(addButton()).toBeDisabled();
    });

    it("should start with the cursor in the calories", async () => {
      await renderCreate();

      expect(calories()).toHaveProp("autoFocus", true);
    });

    describe("the calories", () => {
      it("should ask for them once the field was left empty, and keep Add off", async () => {
        const { user } = await renderCreate();
        await user.type(protein(), "2");

        await fireEvent(calories(), "blur");

        expect(screen.getByRole("alert")).toHaveTextContent("Enter calories.");
        expect(addButton()).toBeDisabled();
      });

      it("should not ask before the field was touched", async () => {
        await renderCreate();

        expect(screen.queryByText("Enter calories.")).not.toBeOnTheScreen();
      });

      it("should ask at once for 0, which is not above 0", async () => {
        const { user } = await renderCreate();

        await user.type(calories(), "0");

        expect(screen.getByRole("alert")).toHaveTextContent("Enter calories.");
        expect(addButton()).toBeDisabled();
      });

      it("should replace the helper with the request for calories", async () => {
        const { user } = await renderCreate();
        await user.type(protein(), "2");
        await user.type(calories(), "0");

        expect(screen.queryByText(/Macros add up to/)).not.toBeOnTheScreen();
      });
    });

    describe("the helper under the calories", () => {
      it("should say what the macros add up to as they are typed", async () => {
        const { user } = await renderCreate();
        await user.type(calories(), "130");

        await fill(user, protein, "2");
        await fill(user, carbohydrate, "15");
        await fill(user, fat, "7");

        expect(screen.getByText("Macros add up to 131 kcal")).toBeOnTheScreen();
      });

      it("should read a comma as a decimal point", async () => {
        const { user } = await renderCreate();
        await user.type(calories(), "100");

        await fill(user, protein, "2,5");

        expect(screen.getByText("Macros add up to 10 kcal")).toBeOnTheScreen();
      });

      it("should be plain while the macros are within a quarter of the calories", async () => {
        const { user } = await renderCreate();
        await user.type(calories(), "100");

        // 31.25 g of carbohydrate is 125 kcal: exactly 25 % over, which is not more than 25 %.
        await fill(user, carbohydrate, "31.25");

        expect(screen.getByText("Macros add up to 125 kcal")).toHaveStyle({
          color: resolvedColor("dark", "text-muted"),
        });
      });

      it("should turn to the review colour past a quarter over the calories", async () => {
        const { user } = await renderCreate();
        await user.type(calories(), "100");

        await fill(user, carbohydrate, "31.5");

        expect(screen.getByText("Macros add up to 126 kcal")).toHaveStyle({
          color: resolvedColor("dark", "warning-ink"),
        });
      });

      it("should turn to the review colour past a quarter under the calories", async () => {
        const { user } = await renderCreate();
        await user.type(calories(), "100");

        await fill(user, carbohydrate, "18.5");

        expect(screen.getByText("Macros add up to 74 kcal")).toHaveStyle({
          color: resolvedColor("dark", "warning-ink"),
        });
      });

      it("should only inform: Add still works when the macros disagree", async () => {
        const { user } = await renderCreate();
        await user.type(calories(), "100");
        await fill(user, carbohydrate, "50");

        expect(addButton()).toBeEnabled();
      });
    });

    describe("Add", () => {
      it("should hand over the numbers, the trimmed label and the Time row's time", async () => {
        const { user, onSubmit } = await renderCreate();
        await user.type(calories(), "130");
        await user.type(protein(), "2");
        await user.type(carbohydrate(), "15");
        await user.type(fat(), "7");
        await user.type(label(), "  Meal deal crisps ");

        await user.press(addButton());

        expect(onSubmit).toHaveBeenCalledWith({
          kcal: 130,
          protein_g: 2,
          carbs_g: 15,
          fat_g: 7,
          label: "Meal deal crisps",
          time: "12:40",
          isNow: true,
        });
      });

      it("should leave out the macros and the label that were left blank", async () => {
        const { user, onSubmit } = await renderCreate();
        await user.type(calories(), "130");

        await user.press(addButton());

        expect(onSubmit).toHaveBeenCalledWith({
          kcal: 130,
          protein_g: null,
          carbs_g: null,
          fat_g: null,
          label: null,
          time: "12:40",
          isNow: true,
        });
      });

      it("should hand over a 0 g macro as given, not as blank", async () => {
        const { user, onSubmit } = await renderCreate();
        await user.type(calories(), "130");
        await user.type(fat(), "0");

        await user.press(addButton());

        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ fat_g: 0, protein_g: null }),
        );
      });

      it("should stay off while a macro is not a number", async () => {
        const { user } = await renderCreate();
        await user.type(calories(), "130");

        await user.type(protein(), "1.2.3");

        expect(addButton()).toBeDisabled();
      });

      it("should keep Add off and hand over nothing for 1,200 calories, which is not 1.2", async () => {
        const { user, onSubmit } = await renderCreate();

        await user.type(calories(), "1,200");
        await user.press(addButton());

        expect(addButton()).toBeDisabled();
        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should keep Add off and hand over nothing for 1,200 in a macro", async () => {
        const { user, onSubmit } = await renderCreate();
        await user.type(calories(), "130");

        await user.type(protein(), "1,200");
        await user.press(addButton());

        expect(addButton()).toBeDisabled();
        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should hand over a decimal comma as a decimal point", async () => {
        const { user, onSubmit } = await renderCreate();
        await user.type(calories(), "130");
        await user.type(protein(), "12,5");

        await user.press(addButton());

        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ protein_g: 12.5 }));
      });

      it("should stay off while the connection is lost", async () => {
        const { user } = await renderCreate({ isOnline: false });
        await user.type(calories(), "130");

        expect(addButton()).toBeDisabled();
      });

      it("should stay off, working, while the entry is being saved", async () => {
        const { user } = await renderCreate({ isSaving: true });
        await user.type(calories(), "130");

        const working = screen.getByRole("button", { name: /Add/, busy: true });
        expect(working).toBeOnTheScreen();
        expect(working).toBeDisabled();
      });
    });

    it("should say it was not saved, as an alert, after a failed save", async () => {
      await renderCreate({ hasSaveError: true });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Not saved. Check your connection and try again.",
      );
    });

    describe("the Time row", () => {
      it("should read Now and the time, as the picker does", async () => {
        await renderCreate();

        expect(screen.getByRole("button", { name: "Time, now, 12:40, change" })).toBeOnTheScreen();
        expect(screen.getByText("Now · 12:40")).toBeOnTheScreen();
      });

      it("should read the hour it was opened for", async () => {
        await renderCreate({ isNow: false, time: "12:00" });

        expect(screen.getByRole("button", { name: "Time, 12:00, change" })).toBeOnTheScreen();
        expect(screen.queryByText(/Now/)).not.toBeOnTheScreen();
      });

      it("should hand over the time chosen in the picker, and that it is no longer Now", async () => {
        const { user, onSubmit } = await renderCreate();
        await user.type(calories(), "130");

        await user.press(screen.getByRole("button", { name: "Time, now, 12:40, change" }));
        await user.press(
          within(screen.getByRole("spinbutton", { name: "Hours" })).getByRole("option", {
            name: "08",
          }),
        );
        await user.press(
          within(screen.getByRole("spinbutton", { name: "Minutes" })).getByRole("option", {
            name: "30",
          }),
        );
        await user.press(screen.getByRole("button", { name: "Done" }));
        await advance(1000);
        await user.press(addButton());

        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ time: "08:30", isNow: false }),
        );
      });
    });
  });

  describe("a logged quick add", () => {
    it("should be titled Edit quick add, with a Back control that leaves", async () => {
      const { user, onLeave } = await renderEdit();

      expect(screen.getByRole("heading", { name: "Edit quick add" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back" }));
      expect(onLeave).toHaveBeenCalledTimes(1);
    });

    it("should show what was logged, in fields that can be changed, and the entry's own time", async () => {
      await renderEdit();

      expect(calories()).toHaveDisplayValue("130");
      expect(protein()).toHaveDisplayValue("2");
      expect(carbohydrate()).toHaveDisplayValue("15");
      expect(fat()).toHaveDisplayValue("7");
      expect(label()).toHaveDisplayValue("Meal deal crisps");
      for (const field of [calories(), protein(), carbohydrate(), fat(), label()]) {
        expect(field).not.toHaveProp("editable", false);
      }
      expect(screen.getByRole("button", { name: "Time, 12:45, change" })).toBeOnTheScreen();
      expect(screen.getByText("Macros add up to 131 kcal")).toBeOnTheScreen();
    });

    it("should not take the cursor on opening", async () => {
      await renderEdit();

      expect(calories()).not.toHaveProp("autoFocus", true);
    });

    it("should hand over the values as they were edited, with the time", async () => {
      const { user, onSubmit } = await renderEdit();

      await fill(user, calories, "150");
      await user.clear(protein());
      await fill(user, fat, "0");
      await user.clear(label());
      await user.press(screen.getByRole("button", { name: "Save" }));

      expect(onSubmit).toHaveBeenCalledWith({
        kcal: 150,
        protein_g: null,
        carbs_g: 15,
        fat_g: 0,
        label: null,
        time: "12:45",
        isNow: false,
      });
    });

    it("should ask for calories and keep Save off when they are cleared", async () => {
      const { user } = await renderEdit();

      await user.clear(calories());

      expect(screen.getByRole("alert")).toHaveTextContent("Enter calories.");
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("should update the helper and turn it to the review colour as the macros are edited", async () => {
      const { user } = await renderEdit();

      await fill(user, carbohydrate, "60");

      expect(screen.getByText("Macros add up to 311 kcal")).toHaveStyle({
        color: resolvedColor("dark", "warning-ink"),
      });
    });

    it("should offer Save and a Delete under it, and no Add", async () => {
      await renderEdit();

      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
    });

    it("should hand over the time chosen, with the values it was shown with", async () => {
      const { user, onSubmit } = await renderEdit();

      await user.press(screen.getByRole("button", { name: "Time, 12:45, change" }));
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Hours" })).getByRole("option", {
          name: "13",
        }),
      );
      await user.press(screen.getByRole("button", { name: "Done" }));
      await advance(1000);
      await user.press(screen.getByRole("button", { name: "Save" }));

      expect(onSubmit).toHaveBeenCalledWith({
        kcal: 130,
        protein_g: 2,
        carbs_g: 15,
        fat_g: 7,
        label: "Meal deal crisps",
        time: "13:45",
        isNow: false,
      });
    });

    it("should delete when Delete is pressed", async () => {
      const { user, onDelete } = await renderEdit();

      await user.press(screen.getByRole("button", { name: "Delete" }));

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("should turn Save and Delete off while the connection is lost", async () => {
      await renderEdit({ isOnline: false });

      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    });

    it("should say it was not saved after a failed save", async () => {
      await renderEdit({ hasSaveError: true });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Not saved. Check your connection and try again.",
      );
    });
  });
});
