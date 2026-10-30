import { TRAIN_HOME } from "@keylow/core/copy";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pagePaddingOf } from "../pagePadding";
import { renderWithTrain, resetTrainBackend } from "./support";

import TrainPage from "@/app/(dashboard)/train/page";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const renderPage = () =>
  renderWithTrain(
    <ToastProvider>
      <TrainPage />
    </ToastProvider>,
  );

describe("Train page", () => {
  beforeEach(() => {
    resetTrainBackend();
  });

  afterEach(() => {
    cleanup();
  });

  it("should be titled Train", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: TRAIN_HOME.title })).toBeTruthy();
  });

  it("should offer to log a session on a first visit, since a session can be started now", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Train with Ki-Lo" });
    expect(screen.getByRole("button", { name: "Log a session" })).toBeTruthy();
  });

  it("should pad top and bottom as the training boards draw it: 16 on a phone, 24 on a desktop", async () => {
    const { container } = renderPage();

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [16, 16],
      desktop: [24, 24],
    });
  });
});
