import { act, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { SwipeToDelete } from "../../components/ui/FoodRow/SwipeToDelete";
import { PressableSurface } from "../../components/ui/PressableSurface";
import { ThemeProvider } from "../../lib/theme";
import { animatedTranslateXPoints } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import {
  claimsMoveBy,
  swipeResponder,
  swipeableRow,
  touchAt,
  touchDown,
} from "../support/swipeResponder";
import { viewsDrawn } from "../support/viewsDrawn";

import type { SwipeToDeleteProps } from "../../components/ui/FoodRow/SwipeToDelete";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

function Row(props: Partial<SwipeToDeleteProps> & { onPressRow?: () => void }) {
  const { onPressRow, ...swipeProps } = props;
  return (
    <ThemeProvider fixedPreference="dark">
      <SwipeToDelete onDelete={() => undefined} {...swipeProps}>
        <PressableSurface className="bg-surface p-4" label="Chicken" onPress={onPressRow}>
          {null}
        </PressableSurface>
      </SwipeToDelete>
    </ThemeProvider>
  );
}

async function settle() {
  await act(() => {
    jest.advanceTimersByTime(500);
  });
}

/** Lifts a finger that went down and moved to (x, y) in `milliseconds`, as the responder system does. */
async function dragTo(x: number, milliseconds = 400, y = 100) {
  const responder = swipeResponder();
  await act(() => {
    responder.onResponderGrant(touchDown);
    responder.onResponderMove(touchAt(x, y, milliseconds));
    responder.onResponderRelease(touchAt(x, y, milliseconds + 1));
  });
  await settle();
}

async function tap() {
  const responder = swipeResponder();
  await act(() => {
    responder.onResponderGrant(touchDown);
    responder.onResponderRelease(touchDown);
  });
  await settle();
}

const isOpen = () => screen.queryByRole("button", { name: "Delete" }) !== null;

describe("SwipeToDelete", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should stack the trash and the word 2 points apart", async () => {
    await render(<Row startsSwiped />);

    expect(viewsDrawn({ width: 88, rowGap: 2 })).toHaveLength(1);
  });

  describe("which touches it takes from the list", () => {
    it("should take a drag that is mostly sideways, to the left", async () => {
      await render(<Row />);

      expect(claimsMoveBy(-20, 4)).toBe(true);
    });

    it("should leave a vertical drag to the list that scrolls, though it drifts left past the slop", async () => {
      await render(<Row />);

      expect(claimsMoveBy(-12, 40)).toBe(false);
    });

    it("should leave a drag of 8 points or less sideways alone, because it may be a tap", async () => {
      await render(<Row />);

      expect(claimsMoveBy(-8, 0)).toBe(false);
    });

    it("should leave a drag to the right alone while the row is closed, for a parent that swipes sideways", async () => {
      await render(<Row />);

      expect(claimsMoveBy(40, 0)).toBe(false);
    });

    it("should take a drag to the right while the row is open, to close it", async () => {
      await render(<Row startsSwiped />);

      expect(claimsMoveBy(40, 0)).toBe(true);
    });
  });

  describe("letting go", () => {
    it("should open on a quick flick left, though the drag is under halfway", async () => {
      await render(<Row />);

      await dragTo(280, 20);

      expect(isOpen()).toBe(true);
    });

    it("should stay closed after the same short drag made slowly", async () => {
      await render(<Row />);

      await dragTo(280, 400);

      expect(isOpen()).toBe(false);
    });

    it("should close on a quick flick right, though the drag is under halfway", async () => {
      await render(<Row startsSwiped />);

      await dragTo(320, 20);

      expect(isOpen()).toBe(false);
    });

    it("should stay open after the same short drag right made slowly", async () => {
      await render(<Row startsSwiped />);

      await dragTo(320, 400);

      expect(isOpen()).toBe(true);
    });
  });

  describe("tapping an open row", () => {
    it("should take the touch from the row, so the row is not pressed", async () => {
      await render(<Row startsSwiped />);

      expect(swipeResponder().onStartShouldSetResponderCapture(touchDown)).toBe(true);
    });

    it("should leave the touch to the row while the row is closed", async () => {
      await render(<Row />);

      expect(swipeResponder().onStartShouldSetResponderCapture(touchDown)).toBe(false);
    });

    it("should close the row", async () => {
      await render(<Row startsSwiped />);

      await tap();

      expect(isOpen()).toBe(false);
    });

    it("should open again when it is dragged open, not a tap", async () => {
      await render(<Row startsSwiped />);

      await dragTo(250, 400);

      expect(isOpen()).toBe(true);
    });
  });

  describe("controlled", () => {
    it("should be open when isOpen is true, and closed when it is false", async () => {
      const view = await render(<Row isOpen />);
      expect(isOpen()).toBe(true);

      await view.rerender(<Row isOpen={false} />);
      await settle();

      expect(isOpen()).toBe(false);
    });

    it("should slide open when isOpen turns true, as when a screen opens one row and closes the others", async () => {
      const view = await render(<Row isOpen={false} />);
      expect(animatedTranslateXPoints(swipeableRow())).toBe(0);

      await view.rerender(<Row isOpen />);
      await settle();

      expect(isOpen()).toBe(true);
      expect(animatedTranslateXPoints(swipeableRow())).toBe(-88);
    });

    it("should slide shut when isOpen turns false, as when the list scrolls", async () => {
      const view = await render(<Row isOpen />);
      expect(animatedTranslateXPoints(swipeableRow())).toBe(-88);

      await view.rerender(<Row isOpen={false} />);
      await settle();

      expect(animatedTranslateXPoints(swipeableRow())).toBe(0);
    });

    it("should say it opened, once, when it is dragged open", async () => {
      const onOpenChange = jest.fn();
      await render(<Row isOpen={false} onOpenChange={onOpenChange} />);

      await dragTo(240);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it("should say it closed when an open row is tapped", async () => {
      const onOpenChange = jest.fn();
      await render(<Row isOpen onOpenChange={onOpenChange} />);

      await tap();

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should say it closed when Delete is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onOpenChange = jest.fn();
      const onDelete = jest.fn();
      await render(<Row isOpen onDelete={onDelete} onOpenChange={onOpenChange} />);

      await user.press(screen.getByRole("button", { name: "Delete" }));

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should say nothing when a drag leaves it where it was", async () => {
      const onOpenChange = jest.fn();
      await render(<Row isOpen={false} onOpenChange={onOpenChange} />);

      await dragTo(280);

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("should not say anything when the screen opens or closes it", async () => {
      const onOpenChange = jest.fn();
      const view = await render(<Row isOpen={false} onOpenChange={onOpenChange} />);

      await view.rerender(<Row isOpen onOpenChange={onOpenChange} />);
      await settle();

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
