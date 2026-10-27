import { render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { TrainBodyMapCard } from "../components/TrainScreen/TrainBodyMapCard";
import { ThemeProvider } from "../lib/theme";
import { goldenThursdayBodyMap } from "./support/bodyMapFixtures";
import { fillsIn, heatFill } from "./support/figureFills";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { TrainBodyMapCardProps } from "../components/TrainScreen/TrainBodyMapCard";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const frontName = "Body map, Actual, heat, front. Open the body map for each muscle.";
const backName = "Body map, Actual, heat, back";

const onToggle = jest.fn<undefined, []>();

const actualProps: TrainBodyMapCardProps = {
  view: "actual",
  values: goldenThursdayBodyMap.values,
  viewLabel: "Actual",
  subLine: "Now · Thu 15 Oct, 17:55",
  toggleLabel: "Show projected",
  isToggleEnabled: true,
  note: null,
  onToggle,
  onOpenBodyMap: () => undefined,
};

async function renderCard(
  props: Partial<TrainBodyMapCardProps> = {},
  scheme: ThemeScheme = "dark",
) {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <TrainBodyMapCard {...actualProps} {...props} />
    </ThemeProvider>,
  );
}

describe("TrainBodyMapCard", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/TrainScreen", "components/ViewLabel"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    onToggle.mockReset();
  });

  describe("the header", () => {
    it("should name the view and the moment it shows", async () => {
      await renderCard();

      expect(screen.getByText("Actual")).toBeOnTheScreen();
      expect(screen.getByText("Now · Thu 15 Oct, 17:55")).toBeOnTheScreen();
    });

    it("should draw the Show projected button and call the toggle when it is pressed", async () => {
      const user = userEvent.setup();
      await renderCard();

      await user.press(screen.getByRole("button", { name: "Show projected" }));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("should name the button for the view it switches to", async () => {
      await renderCard({ view: "projected", viewLabel: "Projected", toggleLabel: "Show actual" });

      expect(screen.getByRole("button", { name: "Show actual" })).toBeOnTheScreen();
    });

    it("should dim the button and not call the toggle when Projected is not available", async () => {
      const user = userEvent.setup();
      await renderCard({ isToggleEnabled: false });

      await user.press(screen.getByRole("button", { name: "Show projected" }));

      expect(screen.getByRole("button", { name: "Show projected" })).toBeDisabled();
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("should draw the Open body map button and call its handler when it is pressed", async () => {
      const onOpenBodyMap = jest.fn();
      const user = userEvent.setup();
      await renderCard({ onOpenBodyMap });

      await user.press(screen.getByRole("button", { name: "Open body map" }));

      expect(onOpenBodyMap).toHaveBeenCalledTimes(1);
    });

    it("should not draw the Open body map button without a handler, so it is never a dead control", async () => {
      await renderCard({ onOpenBodyMap: undefined });

      expect(screen.queryByRole("button", { name: "Open body map" })).not.toBeOnTheScreen();
    });
  });

  describe("a narrow or large-text screen", () => {
    async function renderHeaderParts() {
      await renderCard();

      const buttonGroup = screen.getByRole("button", { name: "Show projected" }).parent?.parent
        ?.parent;
      const headerRow = buttonGroup?.parent;
      const labelColumn = screen.getByText("Now · Thu 15 Oct, 17:55").parent?.parent;

      return { buttonGroup, headerRow, labelColumn };
    }

    it("should keep the label and the buttons on one row, as the board draws it", async () => {
      const { headerRow } = await renderHeaderParts();

      expect(headerRow).toHaveStyle({ flexDirection: "row", alignItems: "center" });
      expect(headerRow).not.toHaveStyle({ flexWrap: "wrap" });
    });

    it("should let the label column take the remaining width and shrink, so its sub-line wraps inside it", async () => {
      const { labelColumn } = await renderHeaderParts();

      expect(labelColumn).toHaveStyle({ flexGrow: 1, flexShrink: 1, minWidth: 0 });
    });

    it("should keep the buttons at their full width", async () => {
      const { buttonGroup } = await renderHeaderParts();

      expect(buttonGroup).toHaveStyle({ flexShrink: 0 });
    });
  });

  describe("the figures", () => {
    it("should draw the front and the back as two images, the front pointing to the body map", async () => {
      await renderCard();

      expect(screen.getByRole("img", { name: frontName })).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: backName })).toBeOnTheScreen();
    });

    it("should name the Projected view in the labels when it is shown", async () => {
      await renderCard({ view: "projected", viewLabel: "Projected" });

      expect(
        screen.getByRole("img", {
          name: "Body map, Projected, heat, front. Open the body map for each muscle.",
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: "Body map, Projected, heat, back" }),
      ).toBeOnTheScreen();
    });

    it("should be plain images: the only buttons are the two in the header", async () => {
      await renderCard();

      expect(screen.getAllByRole("button")).toHaveLength(2);
    });

    it.each(["dark", "light"] as const)(
      "should fill each muscle with its heat step in the %s scheme",
      async (scheme) => {
        await renderCard({}, scheme);

        const front = fillsIn(screen.getByRole("img", { name: frontName }), "front");
        const back = fillsIn(screen.getByRole("img", { name: backName }), "back");

        expect(front.size).toBeGreaterThan(0);
        for (const [muscle, fill] of [...front, ...back]) {
          expect(fill).toEqual(heatFill(scheme, goldenThursdayBodyMap.values[muscle]));
        }
        expect(back.get("lats")).toEqual(heatFill(scheme, 2));
      },
    );

    it("should draw the female figure when the setting says so", async () => {
      await renderCard({ body: "female" });

      const back = fillsIn(screen.getByRole("img", { name: backName }), "back", "female");

      expect(back.size).toBeGreaterThan(0);
      expect(back.get("lats")).toEqual(heatFill("dark", 2));
    });
  });

  describe("the legend", () => {
    it("should draw the heat legend strip beside the figures", async () => {
      await renderCard();

      expect(screen.getByRole("img", { name: "Heat legend" })).toBeOnTheScreen();
    });
  });

  describe("the line under the figures", () => {
    it("should say nothing when there is no note", async () => {
      await renderCard();

      expect(screen.queryByText("Projected needs a routine.")).not.toBeOnTheScreen();
    });

    it("should show the note when it is given", async () => {
      await renderCard({ isToggleEnabled: false, note: "Projected needs a routine." });

      expect(screen.getByText("Projected needs a routine.")).toBeOnTheScreen();
    });
  });
});
