import { weekSummary } from "@keylow/core/diary";
import { themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";

import { DayMarkers } from "../../components/DashboardScreen/DayMarkers";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { resolvedColor } from "../support/themeColor";

import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const days = [
  "2026-10-12",
  "2026-10-13",
  "2026-10-14",
  "2026-10-15",
  "2026-10-16",
  "2026-10-17",
  "2026-10-18",
];

// Thursday 15 October, Monday and Tuesday complete: the sample week.
function markersFor(today: string, completeDays: string[]) {
  return weekSummary({
    days: days.map((localDate) => ({
      localDate,
      dayLog: completeDays.includes(localDate) ? { is_complete: true } : null,
      totals: null,
    })),
    today,
    targetKcal: 2200,
  }).markers;
}

async function renderMarkers(
  markers = markersFor("2026-10-15", days.slice(0, 2)),
  scheme: ThemeScheme = "dark",
) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <DayMarkers markers={markers} />
    </ThemeProvider>,
  );
}

// The markers are decoration in a card whose button says the same in words, so a test asks for hidden elements.
const hidden = { includeHiddenElements: true };
const ring = (name: string) => screen.getByRole("img", { name, ...hidden });
const letters = (day: string) => screen.getByText(day, hidden);

const schemes: ThemeScheme[] = ["dark", "light"];

describe("DayMarkers", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DashboardScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it("should draw the seven days, Monday to Sunday, as two letters each", async () => {
    await renderMarkers();

    expectTextsInOrder(screen.getAllByText(/^(Mo|Tu|We|Th|Fr|Sa|Su)$/, hidden), [
      "Mo",
      "Tu",
      "We",
      "Th",
      "Fr",
      "Sa",
      "Su",
    ]);
  });

  it("should name each ring by its day, and by today or complete when it is", async () => {
    await renderMarkers();

    expect(ring("Monday 12 October, complete")).toBeOnTheScreen();
    expect(ring("Tuesday 13 October, complete")).toBeOnTheScreen();
    expect(ring("Wednesday 14 October")).toBeOnTheScreen();
    expect(ring("Thursday 15 October, today")).toBeOnTheScreen();
    expect(ring("Friday 16 October")).toBeOnTheScreen();
    expect(ring("Sunday 18 October")).toBeOnTheScreen();
  });

  it("should call today complete when it is marked complete", async () => {
    await renderMarkers(markersFor("2026-10-15", ["2026-10-12", "2026-10-15"]));

    expect(ring("Thursday 15 October, today, complete")).toBeOnTheScreen();
  });

  it("should tick a complete day and no other", async () => {
    await renderMarkers();

    expect(screen.getAllByTestId("marker-tick", hidden)).toHaveLength(2);
  });

  it("should not be pressable", async () => {
    await renderMarkers();

    expect(screen.queryByRole("button", hidden)).not.toBeOnTheScreen();
  });

  describe.each(schemes)("its look in %s", (scheme) => {
    it("should fill a complete day with the success muted colour, 20 points across", async () => {
      await renderMarkers(undefined, scheme);

      expect(ring("Monday 12 October, complete")).toHaveStyle({
        backgroundColor: themes[scheme]["success-muted"],
        width: 20,
        height: 20,
      });
    });

    it("should draw the tick in the success colour, as the week strip's complete day does", async () => {
      const { toJSON } = await renderMarkers(undefined, scheme);

      const drawn = JSON.stringify(toJSON());
      expect(drawn.split(`"${themes[scheme].success}"`)).toHaveLength(3);
    });

    it("should draw a day so far that is open as a 1.5 point ring in the strong border colour", async () => {
      await renderMarkers(undefined, scheme);

      expect(ring("Wednesday 14 October")).toHaveStyle({
        borderWidth: 1.5,
        borderColor: resolvedColor(scheme, "border-strong"),
      });
    });

    it("should draw a day to come as a dashed ring, and dim its column to 40 per cent", async () => {
      await renderMarkers(undefined, scheme);

      expect(ring("Friday 16 October")).toHaveStyle({
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: resolvedColor(scheme, "border-strong"),
      });
      expect(ring("Friday 16 October").parent).toHaveStyle({ opacity: Math.fround(0.4) });
      expect(ring("Wednesday 14 October").parent).not.toHaveStyle({ opacity: Math.fround(0.4) });
    });

    it("should set today's letters in the primary text colour at a semibold weight, and the others secondary", async () => {
      await renderMarkers(undefined, scheme);

      expect(letters("Th")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
        fontFamily: "Geist-SemiBold",
      });
      expect(letters("We")).toHaveStyle({
        color: resolvedColor(scheme, "text-secondary"),
        fontFamily: "Geist-Regular",
      });
    });
  });
});
