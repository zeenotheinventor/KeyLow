import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SwitchToManualDialog } from "@/components/targets/SwitchToManualDialog";

afterEach(() => {
  cleanup();
});

function renderDialog(props: { open?: boolean; isSaving?: boolean } = {}) {
  const onKeepProgramme = vi.fn<() => void>();
  const onSaveMyTargets = vi.fn<() => void>();
  render(
    <SwitchToManualDialog
      open={props.open ?? true}
      isSaving={props.isSaving ?? false}
      onKeepProgramme={onKeepProgramme}
      onSaveMyTargets={onSaveMyTargets}
    />,
  );
  return { onKeepProgramme, onSaveMyTargets };
}

describe("SwitchToManualDialog", () => {
  it("should be named for turning off weekly check-ins and say what saving does", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Turn off weekly check-ins?" });

    expect(dialog.textContent).toContain("Saving your own targets ends your programme");
  });

  it("should draw nothing while closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("should put focus on Keep my programme, the safe answer", () => {
    renderDialog();

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep my programme" }));
  });

  it("should put Keep my programme first in the page and Save my targets second", () => {
    renderDialog();

    const labels = screen
      .getAllByRole("button")
      .map((button) => button.textContent)
      .filter((label) => label === "Save my targets" || label === "Keep my programme");

    expect(labels).toEqual(["Keep my programme", "Save my targets"]);
  });

  it("should answer each button and Escape", () => {
    const { onKeepProgramme, onSaveMyTargets } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Save my targets" }));
    expect(onSaveMyTargets).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Keep my programme" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onKeepProgramme).toHaveBeenCalledTimes(2);
  });

  it("should hold Save my targets busy and ignore Escape while saving", () => {
    const { onKeepProgramme } = renderDialog({ isSaving: true });

    expect(screen.getByRole("button", { name: "Saving" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Keep my programme" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onKeepProgramme).not.toHaveBeenCalled();
  });
});
