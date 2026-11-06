import { BODY_MAP } from "@keylow/core/copy";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BodyMapHint } from "@/components/body/BodyMapHint";

describe("BodyMapHint", () => {
  afterEach(() => {
    cleanup();
  });

  it("should say to press and hold a muscle, in the web's words", () => {
    render(<BodyMapHint onDismiss={vi.fn<() => void>()} />);

    expect(screen.getByRole("status").textContent).toBe(BODY_MAP.coachMark.textWeb);
    expect(BODY_MAP.coachMark.textWeb).toBe("Press and hold a muscle for details");
  });

  it("should keep Got it outside the status group, so it can be reached", () => {
    render(<BodyMapHint onDismiss={vi.fn<() => void>()} />);

    const gotIt = screen.getByRole("button", { name: "Got it" });

    expect(within(screen.getByRole("status")).queryByRole("button")).toBeNull();
    expect(gotIt).toBeTruthy();
  });

  it("should call onDismiss when Got it is pressed", () => {
    const onDismiss = vi.fn<() => void>();
    render(<BodyMapHint onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: BODY_MAP.coachMark.dismiss }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
