import {
  EXERCISE_FORM,
  EXERCISE_MUSCLES,
  describeExerciseMusclesButton,
  describeFormPhoto,
  describeFormVideoLink,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formMediaBackend,
  noRows,
  photosRow,
  resetFormMediaBackend,
  serveFormMedia,
  videoRow,
} from "./formMediaBackend";
import { goldenLegsOpen, legsRoutine, previousThursday } from "./sessionGolden";
import { renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import { SessionScreen } from "@/components/train";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

/** Opens the dialog of Leg press, after `beforeOpening` if the test needs the page changed first. */
const openLegPress = async (beforeOpening: () => void = () => undefined) => {
  renderWithTrain(
    <ToastProvider>
      <SessionScreen />
    </ToastProvider>,
  );
  const opener = await screen.findByRole("button", {
    name: describeExerciseMusclesButton("Leg press"),
  });
  beforeOpening();
  await userEvent.click(opener);
  return screen.findByRole("dialog", { name: "Leg press" });
};

describe("the form media in the Muscles it works dialog of the session page", () => {
  beforeEach(() => {
    resetTrainBackend();
    resetFormMediaBackend();
    resetBodyFigureForTests();
    serveFormMedia();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T18:00:00Z"));
    trainBackend.routine = legsRoutine;
    trainBackend.lastPerformance = previousThursday;
    trainBackend.activeSession = goldenLegsOpen(undefined, [], "legs");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  it("should show a video as a link that opens YouTube in a new tab, with no frame in the page", async () => {
    formMediaBackend.rows = [videoRow];
    const dialog = await openLegPress();

    const link = await within(dialog).findByRole("link", {
      name: describeFormVideoLink("How to do a barbell bench press", "Strength Basics"),
    });
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=abcdefghijk");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("should show the start and end photos when there is no video", async () => {
    formMediaBackend.rows = [photosRow];
    const dialog = await openLegPress();

    expect(
      await within(dialog).findByRole("img", { name: describeFormPhoto("Leg press", "start") }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("img", { name: describeFormPhoto("Leg press", "end") }),
    ).toBeTruthy();
    expect(within(dialog).queryByRole("link")).toBeNull();
  });

  it("should show nothing for an exercise with neither, and keep its muscles", async () => {
    formMediaBackend.rows = noRows;
    const dialog = await openLegPress();

    await waitFor(() => {
      expect(formMediaBackend.asked).toHaveLength(1);
    });
    expect(within(dialog).queryByRole("status", { name: EXERCISE_FORM.loadingName })).toBeNull();
    expect(within(dialog).queryByRole("link")).toBeNull();
    expect(within(dialog).queryByText(EXERCISE_FORM.unavailable)).toBeNull();
    expect(within(dialog).getByRole("list", { name: EXERCISE_MUSCLES.listLabel })).toBeTruthy();
  });

  it("should put the form above the caption and the muscles", async () => {
    formMediaBackend.rows = [videoRow];
    const dialog = await openLegPress();

    const link = await within(dialog).findByRole("link");
    const caption = within(dialog).getByText(EXERCISE_MUSCLES.caption);
    const list = within(dialog).getByRole("list", { name: EXERCISE_MUSCLES.listLabel });
    expect(link.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("should show the loading card while the read is out", async () => {
    formMediaBackend.isHanging = true;
    const dialog = await openLegPress();

    expect(
      await within(dialog).findByRole("status", { name: EXERCISE_FORM.loadingName }),
    ).toBeTruthy();
  });

  it("should say the guide is unavailable when the read fails", async () => {
    formMediaBackend.isFailing = true;
    const dialog = await openLegPress();

    expect(await within(dialog).findByText(EXERCISE_FORM.unavailable)).toBeTruthy();
    expect(within(dialog).queryByRole("status", { name: EXERCISE_FORM.loadingName })).toBeNull();
  });

  it("should say the guide is unavailable offline and not load for ever", async () => {
    const dialog = await openLegPress(() => {
      act(() => {
        onlineManager.setOnline(false);
      });
    });

    expect(await within(dialog).findByText(EXERCISE_FORM.unavailable)).toBeTruthy();
    expect(within(dialog).queryByRole("status", { name: EXERCISE_FORM.loadingName })).toBeNull();
    expect(formMediaBackend.asked).toEqual([]);
  });

  it("should not read the form media until the dialog is opened", async () => {
    formMediaBackend.rows = [videoRow];
    renderWithTrain(
      <ToastProvider>
        <SessionScreen />
      </ToastProvider>,
    );
    await screen.findByRole("button", { name: describeExerciseMusclesButton("Leg press") });

    expect(formMediaBackend.asked).toEqual([]);
  });
});
