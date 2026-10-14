import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppearanceSetting } from "@/app/(dashboard)/more/AppearanceSetting";

const { setTheme } = vi.hoisted(() => ({ setTheme: vi.fn(() => Promise.resolve()) }));

vi.mock("@/lib/theme/setTheme", () => ({ setTheme }));

function renderSetting(initialPreference: "dark" | "light" | "device") {
  render(
    <ul>
      <AppearanceSetting initialPreference={initialPreference} />
    </ul>,
  );
}

describe("AppearanceSetting", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should offer Dark, Light and Match device in a group named Appearance", () => {
    renderSetting("dark");

    const group = screen.getByRole("radiogroup", { name: "Appearance" });
    expect(group).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Light" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Match device" })).toBeTruthy();
  });

  it.each([
    ["dark", "Dark"],
    ["light", "Light"],
    ["device", "Match device"],
  ] as const)("should show %s selected when that is the saved preference", (preference, label) => {
    renderSetting(preference);

    expect(screen.getByRole("radio", { name: label })).toHaveProperty("checked", true);
  });

  it("should switch the theme and select the choice when Light is pressed", async () => {
    renderSetting("dark");

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));

    await waitFor(() => {
      expect(setTheme).toHaveBeenCalledWith("light");
    });
    expect(screen.getByRole("radio", { name: "Light" })).toHaveProperty("checked", true);
  });

  it("should switch to device when Match device is pressed", async () => {
    renderSetting("light");

    fireEvent.click(screen.getByRole("radio", { name: "Match device" }));

    await waitFor(() => {
      expect(setTheme).toHaveBeenCalledWith("device");
    });
  });

  it("should put the selection back when the choice cannot be saved", async () => {
    setTheme.mockRejectedValueOnce(new Error("offline"));
    renderSetting("dark");

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "Dark" })).toHaveProperty("checked", true);
    });
    expect(screen.getByRole("radio", { name: "Light" })).toHaveProperty("checked", false);
  });
});
