import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import * as badgeStories from "@/components/ui/Badge/Badge.stories";
import * as bannerStories from "@/components/ui/Banner/Banner.stories";
import * as buttonStories from "@/components/ui/Button/Button.stories";
import * as calorieRingStories from "@/components/ui/CalorieRing/CalorieRing.stories";
import * as cardStories from "@/components/ui/Card/Card.stories";
import * as checkboxStories from "@/components/ui/Checkbox/Checkbox.stories";
import * as chipGroupStories from "@/components/ui/ChipGroup/ChipGroup.stories";
import * as dayCompleteToggleStories from "@/components/ui/DayCompleteToggle/DayCompleteToggle.stories";
import * as dayStepperStories from "@/components/ui/DayStepper/DayStepper.stories";
import * as dialogStories from "@/components/ui/Dialog/Dialog.stories";
import * as emptyStateStories from "@/components/ui/EmptyState/EmptyState.stories";
import * as errorStateStories from "@/components/ui/ErrorState/ErrorState.stories";
import * as foodRowStories from "@/components/ui/FoodRow/FoodRow.stories";
import * as foodTableStories from "@/components/ui/FoodTable/FoodTable.stories";
import * as foodTableHeaderStories from "@/components/ui/FoodTableHeader/FoodTableHeader.stories";
import * as groupedListStories from "@/components/ui/GroupedList/GroupedList.stories";
import * as incompleteDaysChipStories from "@/components/ui/IncompleteDaysChip/IncompleteDaysChip.stories";
import * as inputStories from "@/components/ui/Input/Input.stories";
import * as kiLoMarkStories from "@/components/ui/KiLoMark/KiLoMark.stories";
import * as listRowStories from "@/components/ui/ListRow/ListRow.stories";
import * as macroBarsStories from "@/components/ui/MacroBars/MacroBars.stories";
import * as macroProgressStripStories from "@/components/ui/MacroProgressStrip/MacroProgressStrip.stories";
import * as numericInputStories from "@/components/ui/NumericInput/NumericInput.stories";
import * as nutrientTableStories from "@/components/ui/NutrientTable/NutrientTable.stories";
import * as searchFieldStories from "@/components/ui/SearchField/SearchField.stories";
import * as segmentedControlStories from "@/components/ui/SegmentedControl/SegmentedControl.stories";
import * as skeletonStories from "@/components/ui/Skeleton/Skeleton.stories";
import { storyManifest } from "@/components/ui/storyManifest";
import * as toastStories from "@/components/ui/Toast/Toast.stories";
import * as weekStripStories from "@/components/ui/WeekStrip/WeekStrip.stories";

const storyModules: Record<string, object> = {
  "Banner/Banner.stories.tsx": bannerStories,
  "DayCompleteToggle/DayCompleteToggle.stories.tsx": dayCompleteToggleStories,
  "DayStepper/DayStepper.stories.tsx": dayStepperStories,
  "IncompleteDaysChip/IncompleteDaysChip.stories.tsx": incompleteDaysChipStories,
  "Checkbox/Checkbox.stories.tsx": checkboxStories,
  "EmptyState/EmptyState.stories.tsx": emptyStateStories,
  "ErrorState/ErrorState.stories.tsx": errorStateStories,
  "FoodRow/FoodRow.stories.tsx": foodRowStories,
  "FoodTable/FoodTable.stories.tsx": foodTableStories,
  "FoodTableHeader/FoodTableHeader.stories.tsx": foodTableHeaderStories,
  "GroupedList/GroupedList.stories.tsx": groupedListStories,
  "KiLoMark/KiLoMark.stories.tsx": kiLoMarkStories,
  "ListRow/ListRow.stories.tsx": listRowStories,
  "NumericInput/NumericInput.stories.tsx": numericInputStories,
  "NutrientTable/NutrientTable.stories.tsx": nutrientTableStories,
  "SegmentedControl/SegmentedControl.stories.tsx": segmentedControlStories,
  "Skeleton/Skeleton.stories.tsx": skeletonStories,
  "Badge/Badge.stories.tsx": badgeStories,
  "Button/Button.stories.tsx": buttonStories,
  "CalorieRing/CalorieRing.stories.tsx": calorieRingStories,
  "Card/Card.stories.tsx": cardStories,
  "ChipGroup/ChipGroup.stories.tsx": chipGroupStories,
  "MacroBars/MacroBars.stories.tsx": macroBarsStories,
  "Dialog/Dialog.stories.tsx": dialogStories,
  "MacroProgressStrip/MacroProgressStrip.stories.tsx": macroProgressStripStories,
  "WeekStrip/WeekStrip.stories.tsx": weekStripStories,
  "Input/Input.stories.tsx": inputStories,
  "SearchField/SearchField.stories.tsx": searchFieldStories,
  "Toast/Toast.stories.tsx": toastStories,
};

const uiDirectory = join(__dirname, "../../components/ui");

describe("storyManifest", () => {
  it("should list every primitive that has a stories file", () => {
    const storyFiles = readdirSync(uiDirectory, { recursive: true, encoding: "utf8" })
      .filter((name) => name.endsWith(".stories.tsx"))
      .sort();

    expect(Object.keys(storyManifest).sort()).toEqual(storyFiles);
  });

  it("should have a stories module for every primitive in the manifest", () => {
    expect(Object.keys(storyModules).sort()).toEqual(Object.keys(storyManifest).sort());
  });

  describe.each(Object.entries(storyManifest))("%s", (file, states) => {
    it.each(states)("should have a story for the %s state", (state) => {
      expect(Object.keys(storyModules[file] ?? {})).toContain(state);
    });
  });
});
