import { act, renderHook } from "@testing-library/react-native";
import { TextInput } from "react-native";

import { useScrollFocusedInputIntoView } from "../lib/useScrollFocusedInputIntoView";
import { focusFieldAt, holdFrames, viewAt } from "./support/focusedField";

// The scroll view the hook scrolls, as far as the hook uses it: where it is, how tall its content is, and a
// scroll to a place. Its content is long unless a test says otherwise.
function scrollViewAt(top: number, height: number, contentHeight = 5000) {
  const scrollTo = jest.fn();
  return {
    ref: {
      current: {
        getNativeScrollRef: () => viewAt(top, height),
        getInnerViewRef: () => viewAt(0, contentHeight),
        scrollTo,
      },
    },
    scrollTo,
  };
}

// The scroll view is 800 points tall from 100 down, so it ends at 900, and it is scrolled 200 down.
async function renderAt(keyboardLift: number, contentHeight?: number) {
  const scrollView = scrollViewAt(100, 800, contentHeight);
  const view = await renderHook<ReturnType<typeof useScrollFocusedInputIntoView>, { lift: number }>(
    ({ lift }) => useScrollFocusedInputIntoView(scrollView.ref, lift),
    { initialProps: { lift: 0 } },
  );
  await act(() => {
    view.result.current({ nativeEvent: { contentOffset: { y: 200 } } });
  });
  await view.rerender({ lift: keyboardLift });
  return scrollView;
}

describe("useScrollFocusedInputIntoView", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should scroll the focused field up above the bottom edge, with room to spare, when the keyboard rises", async () => {
    focusFieldAt(900, 100);
    const frames = holdFrames();

    const { scrollTo } = await renderAt(240);
    await frames.run();

    // The field ends at 1000, 100 below the scroll view's end and 116 with the room to spare.
    expect(scrollTo).toHaveBeenCalledWith({ y: 200 + 116, animated: false });
  });

  it("should wait for the next frame, when the scroll view has taken its new height, to measure", async () => {
    focusFieldAt(900, 100);
    holdFrames();

    const { scrollTo } = await renderAt(240);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("should not scroll for a keyboard that has gone by the next frame", async () => {
    focusFieldAt(900, 100);
    const frames = holdFrames();
    const scrollView = scrollViewAt(100, 800);
    const view = await renderHook<
      ReturnType<typeof useScrollFocusedInputIntoView>,
      { lift: number }
    >(({ lift }) => useScrollFocusedInputIntoView(scrollView.ref, lift), {
      initialProps: { lift: 240 },
    });

    await view.rerender({ lift: 0 });
    await frames.run();

    expect(scrollView.scrollTo).not.toHaveBeenCalled();
  });

  it("should not scroll when the focused field is already clear of the bottom edge", async () => {
    focusFieldAt(500, 100);
    const frames = holdFrames();

    const { scrollTo } = await renderAt(240);
    await frames.run();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("should not scroll past the end of the content, when the field is below where the content ends", async () => {
    focusFieldAt(900, 100);
    const frames = holdFrames();

    // The content is 1050 points tall in a scroll view 800 tall, so it scrolls 250 at most, and it is at 200.
    const { scrollTo } = await renderAt(240, 1050);
    await frames.run();

    expect(scrollTo).toHaveBeenCalledWith({ y: 250, animated: false });
  });

  it("should not scroll when the content has no more to scroll to", async () => {
    focusFieldAt(900, 100);
    const frames = holdFrames();

    // The content ends where the scroll view does, and the scroll view is at 200, past the end of it.
    const { scrollTo } = await renderAt(240, 800);
    await frames.run();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("should not scroll by more than the height of the scroll view, when the field is measured far below it", async () => {
    focusFieldAt(90000, 100);
    const frames = holdFrames();

    const { scrollTo } = await renderAt(240);
    await frames.run();

    expect(scrollTo).toHaveBeenCalledWith({ y: 200 + 800, animated: false });
  });

  it("should not scroll while the keyboard is down", async () => {
    focusFieldAt(900, 100);

    const { scrollTo } = await renderAt(0);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("should not scroll when no field has focus", async () => {
    jest.spyOn(TextInput.State, "currentlyFocusedInput").mockImplementation(jest.fn());
    const frames = holdFrames();

    const { scrollTo } = await renderAt(240);
    await frames.run();

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
