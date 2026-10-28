import { describeSetColumns } from "@keylow/core/copy";
import { cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { ExerciseCard } from "../components/ExerciseCard";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { ActiveExerciseCardProps } from "../components/ExerciseCard";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

function renderCard(props: Partial<ActiveExerciseCardProps> = {}) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <ExerciseCard
        columns={describeSetColumns("kg")}
        name="Leg Press"
        rows={[]}
        target="3 × 10 to 12 · RIR 1 · Machine"
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("the exercise card's way to the muscles it works", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/ExerciseCard"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("when given what to do", () => {
    it("should draw a button named for the exercise that asks for the muscles when pressed", async () => {
      const onShowMuscles = jest.fn();
      const user = userEvent.setup();
      await renderCard({ onShowMuscles });

      await user.press(screen.getByRole("button", { name: "Muscles for Leg Press" }));

      expect(onShowMuscles).toHaveBeenCalledTimes(1);
    });

    it("should ask for the muscles when the exercise's name is pressed", async () => {
      const onShowMuscles = jest.fn();
      const user = userEvent.setup();
      await renderCard({ onShowMuscles });

      await user.press(screen.getByRole("heading", { name: "Leg Press" }));

      expect(onShowMuscles).toHaveBeenCalledTimes(1);
    });

    it("should still be a region named for the exercise, with the name as its heading", async () => {
      await renderCard({ onShowMuscles: jest.fn() });

      const region = screen.getByLabelText("Leg Press");

      expect(region).toHaveProp("role", "region");
      expect(within(region).getByRole("heading", { name: "Leg Press" })).toBeOnTheScreen();
    });

    it("should leave the name out of the screen reader's stops, since the button names the same action", async () => {
      await renderCard({ onShowMuscles: jest.fn() });

      const heading = screen.getByRole("heading", { name: "Leg Press" });
      const pressable = heading.parent;

      expect(pressable).toHaveProp("accessible", false);
    });

    it("should press from the whole of the name and target column, which is what reaches 44 points", async () => {
      const onShowMuscles = jest.fn();
      const user = userEvent.setup();
      await renderCard({ onShowMuscles });

      const target = screen.getByText("3 × 10 to 12 · RIR 1 · Machine");
      await user.press(target);

      expect(target.parent).toBe(screen.getByRole("heading", { name: "Leg Press" }).parent);
      expect(onShowMuscles).toHaveBeenCalledTimes(1);
    });
  });

  describe("when given nothing to do", () => {
    it("should draw no such button", async () => {
      await renderCard();

      expect(screen.queryByRole("button", { name: /^Muscles for/ })).not.toBeOnTheScreen();
    });

    it("should draw the name as a heading with nothing to press", async () => {
      await renderCard();

      const heading = screen.getByRole("heading", { name: "Leg Press" });

      expect(heading.parent).not.toHaveProp("onPress");
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });
  });
});
