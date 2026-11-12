import { PROGRAM_TOAST } from "@keylow/core/copy";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCheckinToast } from "@/components/diary/DiaryDay/useCheckinToast";
import { ToastProvider } from "@/components/ui/Toast";
import { announceNewTargets, hasNewTargets, takeNewTargets } from "@/lib/checkinToast";

const { push } = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function TheDiary() {
  useCheckinToast();
  return <p>The Diary</p>;
}

let visibility: DocumentVisibilityState;

function changeVisibility(next: DocumentVisibilityState) {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

const renderDiary = () =>
  render(
    <ToastProvider>
      <TheDiary />
    </ToastProvider>,
  );

beforeEach(() => {
  push.mockReset();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  takeNewTargets();
});

describe("the new targets toast on the Diary", () => {
  it("should say nothing when no check-in has set a new target", () => {
    renderDiary();

    expect(screen.queryByText(PROGRAM_TOAST.message)).toBeNull();
  });

  it("should show when a check-in sets a new target while the Diary is on screen", () => {
    renderDiary();

    act(() => {
      announceNewTargets();
    });

    expect(screen.getByText(PROGRAM_TOAST.message)).toBeTruthy();
    expect(screen.getByRole("button", { name: PROGRAM_TOAST.actionLabel })).toBeTruthy();
  });

  it("should carry the refresh icon, as the phone's toast does", () => {
    announceNewTargets();

    renderDiary();

    const icon = screen.getByText(PROGRAM_TOAST.message).previousElementSibling?.firstElementChild;
    expect(icon?.classList.contains("lucide-refresh-cw")).toBe(true);
  });

  it("should wait for the next visit to the Diary when the check-in landed elsewhere, and show it then", () => {
    announceNewTargets();
    expect(hasNewTargets()).toBe(true);

    renderDiary();

    expect(screen.getByText(PROGRAM_TOAST.message)).toBeTruthy();
  });

  it("should use the signal up, so a later visit says nothing", () => {
    announceNewTargets();
    const first = renderDiary();
    first.unmount();

    renderDiary();

    expect(hasNewTargets()).toBe(false);
    expect(screen.queryByText(PROGRAM_TOAST.message)).toBeNull();
  });

  it("should show once when the Diary is drawn again", () => {
    renderDiary();
    act(() => {
      announceNewTargets();
    });
    fireEvent.click(screen.getByRole("button", { name: PROGRAM_TOAST.actionLabel }));
    push.mockClear();

    renderDiary();

    expect(screen.queryByText(PROGRAM_TOAST.message)).toBeNull();
  });

  it("should open the Programme page from See why", () => {
    announceNewTargets();
    renderDiary();

    fireEvent.click(screen.getByRole("button", { name: PROGRAM_TOAST.actionLabel }));

    expect(push).toHaveBeenCalledExactlyOnceWith("/more/program");
  });

  it("should wait for the tab to be in view, so its five seconds are not spent unseen", () => {
    visibility = "hidden";
    renderDiary();

    act(() => {
      announceNewTargets();
    });
    expect(screen.queryByText(PROGRAM_TOAST.message)).toBeNull();
    expect(hasNewTargets()).toBe(true);

    changeVisibility("visible");

    expect(screen.getByText(PROGRAM_TOAST.message)).toBeTruthy();
  });
});
