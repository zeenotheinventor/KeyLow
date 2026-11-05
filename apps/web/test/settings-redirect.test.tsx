import { afterEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "@/app/(dashboard)/settings/page";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect }));

describe("the retired Settings page", () => {
  afterEach(() => {
    redirect.mockReset();
  });

  it("should send /settings to More", () => {
    SettingsPage();

    expect(redirect).toHaveBeenCalledWith("/more");
  });
});
