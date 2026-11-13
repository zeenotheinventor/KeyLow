import { KeyLowProvider } from "@keylow/api-client";
import { ASSISTANT_SHEET, ASSISTANT_STOPPED } from "@keylow/core/copy";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FUNCTIONS_URL,
  panelBackend,
  panelClient,
  panelFetch,
  resetPanelBackend,
  signInPanelClient,
} from "./assistantPanelBackend";
import {
  CONVERSATION_ID,
  TURN_ID,
  eventText,
  openTurnResponse,
  turnResponse,
} from "../../../../packages/api-client/test/support/assistantStream";

import { DashboardNav } from "@/app/(dashboard)/DashboardNav";
import { AssistantDock, AssistantProvider } from "@/components/assistant";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("next/navigation", () => ({
  usePathname: () => "/diary",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/foodLogActions", () => ({
  useFoodLogActions: () => ({ openAddFood: vi.fn(), viewedDate: undefined }),
}));

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <KeyLowProvider client={panelClient} functionsUrl={FUNCTIONS_URL} queryClient={queryClient}>
      <ToastProvider>
        <AssistantProvider>
          <DashboardNav />
          <AssistantDock>
            <main />
          </AssistantDock>
        </AssistantProvider>
      </ToastProvider>
    </KeyLowProvider>,
  );
  await waitFor(() => {
    expect(queryClient.isFetching()).toBe(0);
  });
  await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.title }));
  await screen.findByRole("region", { name: ASSISTANT_SHEET.startersLabel });
}

const askStarter = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[0] }));

describe("the assistant's notices in the panel", () => {
  beforeEach(async () => {
    resetPanelBackend();
    vi.stubGlobal("fetch", panelFetch);
    // jsdom has no layout: the narrow sheet.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    onlineManager.setOnline(true);
    await signInPanelClient();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    onlineManager.setOnline(true);
  });

  it("should say a failed turn, and send your message again with Try again", async () => {
    panelBackend.answerTurn = () => new Response("down", { status: 500 });
    const user = userEvent.setup();
    await openPanel(user);

    await askStarter(user);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "That answer did not come through",
    );
    panelBackend.answerTurn = () => new Response("down", { status: 500 });
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(panelBackend.turnRequests.map(({ text }) => text)).toEqual([
        ASSISTANT_SHEET.starters[0],
        ASSISTANT_SHEET.starters[0],
      ]);
    });
  });

  it("should say the day limit and turn the field off, with no button", async () => {
    panelBackend.answerTurn = () =>
      turnResponse([
        { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
        { type: "notice", notice: { code: "day_limit", resetsAt: "2026-11-14T00:00:00Z" } },
        { type: "done", outcome: "failed" },
      ]);
    const user = userEvent.setup();
    await openPanel(user);

    await askStarter(user);

    // The notice and the field turning off arrive together, so both are waited for in one condition.
    await waitFor(() => {
      expect(screen.queryByText("You have used today's turns")).not.toBeNull();
      expect(
        screen
          .getByRole("textbox", { name: ASSISTANT_SHEET.composerLabel })
          .hasAttribute("disabled"),
      ).toBe(true);
    });
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("should offer Ask again under a reply cut short, and send your message again with it", async () => {
    panelBackend.answerTurn = () =>
      openTurnResponse(
        eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
          eventText({ type: "text", delta: "Yesterday you logged 8 entries" }),
      );
    const user = userEvent.setup();
    await openPanel(user);
    await askStarter(user);
    await screen.findByRole("group", { name: "Assistant: Yesterday you logged 8 entries" });

    await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.closeLabel }));
    await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.title }));
    const askAgain = await screen.findByRole("button", { name: ASSISTANT_STOPPED.askAgain });
    expect(
      within(screen.getByRole("group", { name: ASSISTANT_SHEET.quickRepliesLabel })).getAllByRole(
        "button",
      ),
    ).toHaveLength(1);
    await user.click(askAgain);

    await waitFor(() => {
      expect(panelBackend.turnRequests).toHaveLength(2);
    });
  });
});
