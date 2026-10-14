import { afterEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "@/app/(dashboard)/settings/page";
import WeightPage from "@/app/(dashboard)/weight/page";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect }));

describe("the retired Settings and Weight pages", () => {
  afterEach(() => {
    redirect.mockReset();
  });

  it("should send /settings to More", () => {
    SettingsPage();

    expect(redirect).toHaveBeenCalledWith("/more");
  });

  it("should send /weight to More", () => {
    WeightPage();

    expect(redirect).toHaveBeenCalledWith("/more");
  });
});
