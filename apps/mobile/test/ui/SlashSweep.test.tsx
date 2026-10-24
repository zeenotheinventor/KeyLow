import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { SlashSweep } from "../../components/ui";
import { animatedOpacity } from "../support/animatedStyle";

import type { SlashSweepVariant } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

// The slash is decoration hidden from screen readers, and has no role, so it is found by its test id.
const slash = () => screen.getByTestId("day-complete-slash", { includeHiddenElements: true });

async function renderSlash(variant?: SlashSweepVariant) {
  await render(variant === undefined ? <SlashSweep /> : <SlashSweep variant={variant} />);
}

describe("SlashSweep", () => {
  it("should be 16 percent of the row wide and run 20 percent past its top and bottom by default", async () => {
    await renderSlash();

    expect(slash().parent).toHaveProp(
      "className",
      "pointer-events-none absolute -bottom-[20%] -top-[20%] left-0 w-[16%]",
    );
  });

  it("should be 45 percent of the card wide and run 20 points past its top and bottom as the card variant", async () => {
    await renderSlash("card");

    expect(slash().parent).toHaveProp(
      "className",
      "pointer-events-none absolute -bottom-[20px] -top-[20px] left-0 w-[45%]",
    );
  });

  describe("when it starts", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    async function renderMeasured(variant: SlashSweepVariant) {
      await renderSlash(variant);
      await fireEvent(slash(), "layout", { nativeEvent: { layout: { width: 56 } } });
    }

    async function advance(milliseconds: number) {
      await act(() => {
        jest.advanceTimersByTime(milliseconds);
      });
    }

    it("should hold the card variant at its starting opacity for 120 ms, then sweep", async () => {
      await renderMeasured("card");
      await advance(100);
      const opacityBeforeTheDelay = animatedOpacity(slash());

      await advance(100);

      expect(opacityBeforeTheDelay).toBe(0.9);
      expect(animatedOpacity(slash())).toBeLessThan(0.9);
    });

    it("should start the row variant sweeping at once", async () => {
      await renderMeasured("row");

      await advance(100);

      expect(animatedOpacity(slash())).toBeLessThan(0.9);
    });
  });
});
