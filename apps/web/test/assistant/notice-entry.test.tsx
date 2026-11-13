import { ASSISTANT_STOPPED } from "@keylow/core/copy";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NoticeEntryProps } from "@/components/assistant/NoticeEntry";

import { AskAgain } from "@/components/assistant/AskAgain";
import { AssistantThreadContext } from "@/components/assistant/AssistantThread";
import { NoticeEntry } from "@/components/assistant/NoticeEntry";

afterEach(cleanup);

type Notice = NoticeEntryProps["entry"]["notice"];

function renderNotice(notice: Notice, isLatest: boolean, onSendAgain = vi.fn()) {
  render(
    <AssistantThreadContext
      value={{ timeZone: "Europe/London", canAnswer: true, onAnswer: vi.fn(), onSendAgain }}
    >
      <NoticeEntry entry={{ kind: "notice", key: "n", notice, isLatest }} />
    </AssistantThreadContext>,
  );
  return onSendAgain;
}

describe("NoticeEntry", () => {
  it("should say the day limit with the reset time in the person's time zone, and no button", () => {
    renderNotice({ code: "day_limit", resetsAt: "2026-11-14T00:00:00Z" }, true);

    expect(screen.getByRole("status").textContent).toContain("You have used today's turns");
    expect(screen.getByRole("status").textContent).toContain("The assistant is back at");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("should say the Plus notice", () => {
    renderNotice({ code: "plus" }, true);

    expect(screen.getByRole("status").textContent).toContain("The assistant is part of Ki-Lo Plus");
  });

  it("should say the resting notice with the day it resumes", () => {
    renderNotice({ code: "resting", resumesOn: "2026-12-01" }, true);

    expect(screen.getByRole("status").textContent).toContain(
      "The assistant is resting until 1 December",
    );
  });

  it("should say the switched off notice", () => {
    renderNotice({ code: "switched_off" }, true);

    expect(screen.getByRole("status").textContent).toContain(
      "The assistant is switched off for now",
    );
  });

  it("should say a failed turn as an alert, with Try again that sends the last message again", async () => {
    const onSendAgain = renderNotice({ code: "turn_failed" }, true);

    expect(screen.getByRole("alert").textContent).toContain("That answer did not come through");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onSendAgain).toHaveBeenCalledTimes(1);
  });

  it("should offer Try again on the latest notice only", () => {
    renderNotice({ code: "turn_failed" }, false);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

describe("AskAgain", () => {
  it("should draw nothing when the thread does not offer it", () => {
    render(<AskAgain canAskAgain={false} />);

    expect(screen.queryByRole("button", { name: ASSISTANT_STOPPED.askAgain })).toBeNull();
  });

  it("should send the last message again when it is pressed", async () => {
    const onSendAgain = vi.fn();
    render(
      <AssistantThreadContext
        value={{ timeZone: "UTC", canAnswer: true, onAnswer: vi.fn(), onSendAgain }}
      >
        <AskAgain canAskAgain />
      </AssistantThreadContext>,
    );

    await userEvent.click(screen.getByRole("button", { name: ASSISTANT_STOPPED.askAgain }));

    expect(onSendAgain).toHaveBeenCalledTimes(1);
  });
});
