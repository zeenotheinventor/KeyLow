import { PROGRAM_SCREEN } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { renderWithProgramBackend, resetProgramBackend } from "./programBackend";

import { ProgramActionsCard } from "@/components/program/ProgramScreen/ProgramActionsCard";

beforeEach(() => {
  resetProgramBackend();
  onlineManager.setOnline(true);
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("the Programme actions card", () => {
  it("should link Edit programme to its page, above How it works", async () => {
    renderWithProgramBackend(<ProgramActionsCard />);

    const edit = await screen.findByRole("link", { name: PROGRAM_SCREEN.editLabel });

    expect(edit.getAttribute("href")).toBe("/more/program/edit");
    expect(
      screen
        .getAllByRole("listitem")
        .map((item) => item.textContent)
        .join("|"),
    ).toBe(`${PROGRAM_SCREEN.editLabel}|${PROGRAM_SCREEN.howItWorksLabel}`);
  });

  it("should turn Edit programme off while offline, and leave How it works on", async () => {
    renderWithProgramBackend(<ProgramActionsCard />);
    await screen.findByRole("link", { name: PROGRAM_SCREEN.editLabel });

    act(() => {
      onlineManager.setOnline(false);
    });

    const edit = screen.getByRole("link", { name: PROGRAM_SCREEN.editLabel });
    expect(edit.hasAttribute("href")).toBe(false);
    expect(edit.getAttribute("aria-disabled")).toBe("true");
    expect(
      screen.getByRole("button", { name: PROGRAM_SCREEN.howItWorksLabel }).hasAttribute("disabled"),
    ).toBe(false);
  });
});
