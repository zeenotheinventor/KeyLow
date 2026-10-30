import { TRAIN_HOME } from "@keylow/core/copy";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { pagePaddingOf } from "../pagePadding";
import { renderWithTrain, resetTrainBackend } from "./support";

import TrainPage from "@/app/(dashboard)/train/page";

describe("Train page", () => {
  beforeEach(() => {
    resetTrainBackend();
  });

  afterEach(() => {
    cleanup();
  });

  it("should be titled Train", () => {
    renderWithTrain(<TrainPage />);

    expect(screen.getByRole("heading", { level: 1, name: TRAIN_HOME.title })).toBeTruthy();
  });

  it("should draw no button, since nothing it could start is built yet", async () => {
    renderWithTrain(<TrainPage />);

    await screen.findByRole("heading", { name: "Train with Ki-Lo" });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("should pad top and bottom as the training boards draw it: 16 on a phone, 24 on a desktop", async () => {
    const { container } = renderWithTrain(<TrainPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [16, 16],
      desktop: [24, 24],
    });
  });
});
