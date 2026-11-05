import { WEIGHT_EMPTY } from "@keylow/core/copy";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { pagePaddingOf } from "../pagePadding";
import { renderWithWeight, resetWeightBackend } from "./support";

import WeightPage from "@/app/(dashboard)/weight/page";

describe("Weight page", () => {
  beforeEach(() => {
    resetWeightBackend();
  });

  afterEach(() => {
    cleanup();
  });

  it("should draw the Weight screen where it used to redirect to More", async () => {
    renderWithWeight(<WeightPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Weight" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: WEIGHT_EMPTY.title })).toBeTruthy();
  });

  it("should pad top and bottom as the shell boards draw it: 24 on a phone, 40 on a desktop", async () => {
    const { container } = renderWithWeight(<WeightPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [24, 24],
      desktop: [40, 40],
    });
  });
});
