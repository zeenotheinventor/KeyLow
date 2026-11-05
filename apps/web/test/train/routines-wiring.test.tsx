import { ROUTINES_EMPTY, ROUTINES_SCREEN, TRAIN_HOME, TRAIN_NO_ROUTINE } from "@keylow/core/copy";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUSH_PULL_LEGS_ID,
  UPPER_LOWER_ID,
  pushPullLegs,
  renderWithRoutines,
  resetRoutinesBackend,
  routinesBackend,
  upperLower,
} from "./routinesBackend";
import { renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import { TrainRoute, TrainScreen } from "@/components/train";
import { RoutinesRoute } from "@/components/train/RoutinesRoute";
import { ToastProvider } from "@/components/ui/Toast";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("the Routines link of the Train page", () => {
  beforeEach(() => {
    resetTrainBackend();
  });

  afterEach(cleanup);

  it("should go to the routines page, beside History", async () => {
    renderWithTrain(<TrainScreen />);

    expect(screen.getByRole("link", { name: TRAIN_HOME.routinesLink }).getAttribute("href")).toBe(
      "/train/routines",
    );
    expect(screen.getByRole("link", { name: TRAIN_HOME.historyLink })).toBeTruthy();
    await screen.findByRole("heading", { name: "Train with Ki-Lo" });
  });
});

describe("Create routine on the Train page", () => {
  beforeEach(() => {
    resetTrainBackend();
    router.push.mockReset();
    trainBackend.everLogged = true;
  });

  afterEach(cleanup);

  it("should open the new routine's editor", async () => {
    renderWithTrain(
      <ToastProvider>
        <TrainRoute />
      </ToastProvider>,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: TRAIN_NO_ROUTINE.createAction }),
    );

    expect(router.push).toHaveBeenCalledWith("/train/routines/new");
  });
});

describe("the routines page's buttons", () => {
  beforeEach(() => {
    resetRoutinesBackend();
    router.push.mockReset();
  });

  afterEach(cleanup);

  it("should open the new routine's editor from New routine, and a routine's own from its card and its row", async () => {
    routinesBackend.routines = [pushPullLegs, upperLower];
    renderWithRoutines(<RoutinesRoute />);

    await userEvent.click(
      await screen.findByRole("button", { name: ROUTINES_SCREEN.newRoutineLabel }),
    );
    expect(router.push).toHaveBeenLastCalledWith("/train/routines/new");

    await userEvent.click(screen.getByRole("button", { name: /^Push Pull Legs/ }));
    expect(router.push).toHaveBeenLastCalledWith(`/train/routines/${PUSH_PULL_LEGS_ID}`);

    await userEvent.click(screen.getByRole("button", { name: /^Upper Lower/ }));
    expect(router.push).toHaveBeenLastCalledWith(`/train/routines/${UPPER_LOWER_ID}`);
  });

  it("should open the new routine's editor from Create routine when there are no routines", async () => {
    renderWithRoutines(<RoutinesRoute />);

    await userEvent.click(await screen.findByRole("button", { name: ROUTINES_EMPTY.action }));

    expect(router.push).toHaveBeenCalledWith("/train/routines/new");
  });
});
