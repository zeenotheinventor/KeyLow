import { TRAIN_HOME } from "@keylow/core/copy";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import { TrainScreen } from "@/components/train";

const historyLink = () => screen.getByRole("link", { name: TRAIN_HOME.historyLink });

describe("the History link of the Train page", () => {
  beforeEach(() => {
    resetTrainBackend();
  });

  afterEach(() => {
    cleanup();
  });

  it("should go to the history page, beside the title", async () => {
    renderWithTrain(<TrainScreen />);

    expect(historyLink().getAttribute("href")).toBe("/train/history");
    await screen.findByRole("heading", { name: "Train with Ki-Lo" });
  });

  it("should show while the page loads", () => {
    trainBackend.hangingReads.add("routines");
    renderWithTrain(<TrainScreen />);

    expect(historyLink()).toBeTruthy();
  });

  it("should show when the page does not load", async () => {
    trainBackend.failingReads.add("routines");
    renderWithTrain(<TrainScreen />);

    await screen.findByRole("alert");
    expect(historyLink().getAttribute("href")).toBe("/train/history");
  });
});
