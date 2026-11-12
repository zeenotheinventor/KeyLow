import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AssistantPage from "@/app/(dashboard)/more/assistant/page";

vi.mock("@/components/assistant", () => ({
  AssistantSettingsPage: () => <h1>Assistant settings page</h1>,
}));

describe("the /more/assistant route", () => {
  afterEach(cleanup);

  it("should show the Assistant settings page", () => {
    render(<AssistantPage />);

    expect(screen.getByRole("heading", { name: "Assistant settings page" })).toBeTruthy();
  });
});
