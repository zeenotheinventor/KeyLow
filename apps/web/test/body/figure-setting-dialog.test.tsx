import { BODY_MAP } from "@keylow/core/copy";
import { BODY_ARTWORK } from "@keylow/core/training";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FigureSettingDialogProps } from "@/components/body/FigureSettingDialog";

import { FigureSettingDialog } from "@/components/body/FigureSettingDialog";

function renderDialog(props: Partial<FigureSettingDialogProps> = {}) {
  const onClose = vi.fn<() => void>();
  const onChange = vi.fn<(figure: "male" | "female") => void>();
  render(
    <FigureSettingDialog open figure="male" onClose={onClose} onChange={onChange} {...props} />,
  );
  return { onClose, onChange };
}

const dialog = () => screen.getByRole("dialog", { name: BODY_MAP.figureSetting.sheetTitle });

describe("FigureSettingDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("should draw nothing while it is closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("should be named Figure and say that only the drawing changes", () => {
    renderDialog();

    expect(within(dialog()).getByRole("heading", { name: "Figure" })).toBeTruthy();
    expect(within(dialog()).getByText(BODY_MAP.figureSetting.description)).toBeTruthy();
  });

  it("should offer Male and Female in a group named Figure: male or female, with the figure drawn chosen", () => {
    renderDialog({ figure: "female" });

    const group = within(dialog()).getByRole("radiogroup", { name: BODY_MAP.figureSetting.label });
    expect(within(group).getByRole<HTMLInputElement>("radio", { name: "Male" }).checked).toBe(
      false,
    );
    expect(within(group).getByRole<HTMLInputElement>("radio", { name: "Female" }).checked).toBe(
      true,
    );
  });

  it("should report the figure pressed and stay open", () => {
    const { onChange, onClose } = renderDialog();

    fireEvent.click(within(dialog()).getByRole("radio", { name: "Female" }));

    expect(onChange).toHaveBeenCalledWith("female");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should close from Done", () => {
    const { onClose } = renderDialog();

    fireEvent.click(within(dialog()).getByRole("button", { name: BODY_MAP.figureSetting.done }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should draw the figure chosen as a preview that a screen reader skips", () => {
    renderDialog({ figure: "female" });

    const preview = within(dialog()).getByRole("img", { hidden: true });
    expect(preview.getAttribute("width")).toBe("84");
    expect(preview.querySelector(`path[d="${BODY_ARTWORK.female.front.outline}"]`)).not.toBeNull();
    expect(within(dialog()).queryByRole("img")).toBeNull();
  });
});
