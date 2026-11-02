import { VOLUME_STATUSES } from "@keylow/core/training";
import { render, screen, userEvent, within } from "@testing-library/react-native";

import {
  DashboardBodyMapCard,
  RESTING_HEAT,
} from "../../components/DashboardScreen/DashboardBodyMapCard";
import { ThemeProvider } from "../../lib/theme";
import { fillsIn, volumeFill } from "../support/figureFills";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { DashboardBodyMap } from "@keylow/api-client";
import type { MuscleId } from "@keylow/core/training";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The words and figures inside the card sit under its one name, which a screen reader reads on its own, so
// they are hidden from it and the tests ask for hidden elements to read what they say.
const hidden = { includeHiddenElements: true };

const NOT_TRAINED = VOLUME_STATUSES.indexOf("not_trained");
const MAINTAINING = VOLUME_STATUSES.indexOf("maintaining");
const GROWING = VOLUME_STATUSES.indexOf("growing");
const PRODUCTIVE = VOLUME_STATUSES.indexOf("productive");
const HIGH = VOLUME_STATUSES.indexOf("high");

function volumeValues(overrides: Partial<Record<MuscleId, number>>): DashboardBodyMap["values"] {
  return { ...RESTING_HEAT, ...overrides };
}

// The board's Monday evening: 8 muscles at Growing or above.
const mondayEvening: DashboardBodyMap = {
  warmest: [],
  values: {
    ...volumeValues({}),
    chest_upper: GROWING,
    chest_lower: GROWING,
    delt_front: MAINTAINING,
    delt_side: MAINTAINING,
    delt_rear: GROWING,
    lats: PRODUCTIVE,
    traps_mid: GROWING,
    biceps: HIGH,
    triceps: MAINTAINING,
    quads: GROWING,
  },
  today: { kind: "planned", dayName: "Legs", setCount: 16 },
};

const emptyWeek: DashboardBodyMap = {
  warmest: [],
  values: volumeValues({}),
  today: { kind: "planned", dayName: "Legs", setCount: 16 },
};

const openBodyMap = jest.fn<undefined, []>();

async function renderCard(bodyMap: DashboardBodyMap, scheme: ThemeScheme = "dark") {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <DashboardBodyMapCard bodyMap={bodyMap} scale="volume" onOpen={openBodyMap} />
    </ThemeProvider>,
  );
}

const mondayEveningName =
  "Body map, weekly volume, Actual this week, Monday to Sunday. 7 of 22 muscles at Growing or above. Today: Legs, 16 sets planned. Open the body map on Volume";

describe("DashboardBodyMapCard in weekly volume", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/DashboardScreen",
      "components/BodyMapLegend",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    openBodyMap.mockReset();
  });

  describe("with sets logged this week", () => {
    it("should be named by the weekly volume, the count at Growing or above and today, ending with the words that open Volume", async () => {
      await renderCard(mondayEvening);

      expect(screen.getByLabelText(mondayEveningName)).toBeOnTheScreen();
    });

    it("should head the card with Training and Actual · this week, with the Body map link", async () => {
      await renderCard(mondayEvening);

      expect(screen.getByText("Training", hidden)).toBeOnTheScreen();
      expect(screen.getByText("Actual · this week", hidden)).toBeOnTheScreen();
      expect(screen.queryByText("Actual · now", hidden)).not.toBeOnTheScreen();
      expect(screen.getByText("Body map", hidden)).toBeOnTheScreen();
    });

    it("should write the count and today's line under the figures", async () => {
      await renderCard(mondayEvening);

      expect(screen.getByText("7 of 22 muscles at Growing or above", hidden)).toBeOnTheScreen();
      expect(screen.getByText("Today: Legs", hidden)).toBeOnTheScreen();
    });

    it("should draw the front and the back as two volume images, each with its label", async () => {
      await renderCard(mondayEvening);

      expect(
        screen.getByRole("img", { name: "Body map, Actual, weekly sets, front", ...hidden }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: "Body map, Actual, weekly sets, back", ...hidden }),
      ).toBeOnTheScreen();
    });

    it.each(["dark", "light"] as const)(
      "should fill each muscle with its volume band in the %s theme",
      async (scheme) => {
        await renderCard(mondayEvening, scheme);
        const front = fillsIn(
          screen.getByRole("img", { name: "Body map, Actual, weekly sets, front", ...hidden }),
          "front",
        );
        const back = fillsIn(
          screen.getByRole("img", { name: "Body map, Actual, weekly sets, back", ...hidden }),
          "back",
        );

        expect(front.get("biceps")).toEqual(volumeFill(scheme, HIGH));
        expect(front.get("quads")).toEqual(volumeFill(scheme, GROWING));
        expect(front.get("delt_front")).toEqual(volumeFill(scheme, MAINTAINING));
        expect(back.get("lats")).toEqual(volumeFill(scheme, PRODUCTIVE));
        expect(back.get("calves")).toEqual(volumeFill(scheme, NOT_TRAINED));
      },
    );

    it("should draw the volume legend beside the figures, High at the top and None at the bottom", async () => {
      await renderCard(mondayEvening);

      const legend = screen.getByRole("img", { name: "Volume legend", ...hidden });

      expect(within(legend).getByText("High", hidden)).toBeOnTheScreen();
      expect(within(legend).getByText("None", hidden)).toBeOnTheScreen();
      expect(screen.queryByText("Peak", hidden)).not.toBeOnTheScreen();
    });
  });

  describe("with no sets this week", () => {
    it("should draw every muscle Not trained", async () => {
      await renderCard(emptyWeek);
      const front = fillsIn(
        screen.getByRole("img", { name: "Body map, Actual, weekly sets, front", ...hidden }),
        "front",
      );

      expect(front.size).toBeGreaterThan(0);
      for (const fill of front.values()) {
        expect(fill).toEqual(volumeFill("dark", NOT_TRAINED));
      }
    });

    it("should say No sets yet this week in the line and in the name, and keep the legend and the Today line", async () => {
      await renderCard(emptyWeek);

      expect(screen.getByText("No sets yet this week", hidden)).toBeOnTheScreen();
      expect(screen.getByText("Today: Legs", hidden)).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: "Volume legend", ...hidden })).toBeOnTheScreen();
      expect(
        screen.getByLabelText(
          "Body map, weekly volume, Actual this week, Monday to Sunday. No sets yet this week. Today: Legs, 16 sets planned. Open the body map on Volume",
        ),
      ).toBeOnTheScreen();
    });
  });

  describe("a day with no plan to state", () => {
    it("should draw no Today line, and the name stops at the count", async () => {
      await renderCard({ ...mondayEvening, today: { kind: "none", dayName: null } });

      expect(screen.queryByText(/^Today/, hidden)).not.toBeOnTheScreen();
      expect(
        screen.getByLabelText(
          "Body map, weekly volume, Actual this week, Monday to Sunday. 7 of 22 muscles at Growing or above. Open the body map on Volume",
        ),
      ).toBeOnTheScreen();
    });
  });

  describe("pressing", () => {
    it("should be one button under the single name, with its words hidden from a screen reader", async () => {
      await renderCard(mondayEvening);

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.getByRole("button", { name: mondayEveningName })).toBeOnTheScreen();
      expect(screen.queryByText("Training")).not.toBeOnTheScreen();
    });

    it("should open the body map when pressed", async () => {
      const user = userEvent.setup();
      await renderCard(mondayEvening);

      await user.press(screen.getByRole("button", { name: mondayEveningName }));

      expect(openBodyMap).toHaveBeenCalledTimes(1);
    });
  });
});
