import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AssistantChangesRoute from "@/app/(dashboard)/more/assistant/changes/page";

vi.mock("@/components/assistant/AssistantChangesPage", () => ({
  AssistantChangesPage: () => <h1>Assistant changes page</h1>,
}));

describe("the /more/assistant/changes route", () => {
  afterEach(cleanup);

  it("should show the What the assistant changed page", () => {
    render(<AssistantChangesRoute />);

    expect(screen.getByRole("heading", { name: "Assistant changes page" })).toBeTruthy();
  });
});
