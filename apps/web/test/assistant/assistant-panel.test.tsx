import { KeyLowProvider } from "@keylow/api-client";
import {
  ASSISTANT_CONSENT_CARD,
  ASSISTANT_NOT_MEDICAL_ADVICE,
  ASSISTANT_OFFLINE,
  ASSISTANT_SHEET,
  ASSISTANT_STOPPED,
  ASSISTANT_TRAIN_SHEET,
  LEGAL_PATHS,
  SAVE_FAILED_BANNER,
} from "@keylow/core/copy";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
  CONFIRMATION_ID,
  CONVERSATION_ID,
  TURN_ID,
  eventText,
  openTurnResponse,
  replyEvents,
  turnResponse,
} from "../../../../packages/api-client/test/support/assistantStream";

import type { AssistantStreamEvent } from "@keylow/core";

import { DashboardNav } from "@/app/(dashboard)/DashboardNav";
import { AssistantDock, AssistantProvider } from "@/components/assistant";
import { buttonVariants } from "@/components/ui/Button";
import { ToastProvider } from "@/components/ui/Toast";

const { pathname, viewedDate } = vi.hoisted(() => ({
  pathname: vi.fn<() => string>(),
  viewedDate: vi.fn<() => string | undefined>(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/foodLogActions", () => ({
  useFoodLogActions: () => ({
    openAddFood: vi.fn(),
    viewedDate: viewedDate(),
    setAssistantDescribeOpener: vi.fn(),
  }),
}));

// jsdom has no layout, so the breakpoint is whatever a test says it is, and a test can change it while the
// panel is on screen.
let windowWidth = 375;
const mediaListeners = new Set<() => void>();

function setWindowWidth(width: number) {
  windowWidth = width;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return windowWidth >= 1024 && query === "(min-width: 1024px)";
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => {
      mediaListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      mediaListeners.delete(listener);
    },
  }));
}

function resizeWindow(width: number) {
  windowWidth = width;
  act(() => {
    mediaListeners.forEach((listener) => {
      listener();
    });
  });
}

async function renderApp(path = "/diary") {
  pathname.mockReturnValue(path);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // A new element each time, so a rerender really renders the app again.
  const app = () => (
    <KeyLowProvider client={panelClient} functionsUrl={FUNCTIONS_URL} queryClient={queryClient}>
      <ToastProvider>
        <AssistantProvider>
          <DashboardNav />
          <AssistantDock>
            <main>
              <h1>The page</h1>
            </main>
          </AssistantDock>
        </AssistantProvider>
      </ToastProvider>
    </KeyLowProvider>
  );
  const view = render(app());
  // The profile's time zone is read before the first press, as it is in the app.
  await waitFor(() => {
    expect(queryClient.isFetching()).toBe(0);
  });
  return {
    ...view,
    // The page changes under the panel, as a client navigation does.
    goTo: (nextPath: string) => {
      pathname.mockReturnValue(nextPath);
      view.rerender(app());
    },
  };
}

const assistantButton = () => screen.getByRole("button", { name: ASSISTANT_SHEET.title });
const field = () => screen.getByRole("textbox", { name: ASSISTANT_SHEET.composerLabel });
const sendButton = () => screen.getByRole("button", { name: ASSISTANT_SHEET.sendLabel });
const panel = () => screen.getByRole("dialog", { name: ASSISTANT_SHEET.title });

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(assistantButton());
  // The panel has read its status and conversation when the starters or the consent card are drawn.
  await screen.findByRole("region", { name: ASSISTANT_SHEET.startersLabel });
}

const turnEvent = eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID });

// A stream the test writes to as it likes, as a turn being written is.
function controlledStream() {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(started) {
      controller = started;
    },
  });
  return {
    response: new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
    push: (text: string) => {
      controller?.enqueue(encoder.encode(text));
    },
  };
}

const stoppedStream = (text: string) =>
  openTurnResponse(
    eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
      eventText({ type: "text", delta: text }),
  );

describe("the assistant panel", () => {
  beforeEach(async () => {
    resetPanelBackend();
    mediaListeners.clear();
    viewedDate.mockReturnValue(undefined);
    setWindowWidth(375);
    vi.stubGlobal("fetch", panelFetch);
    onlineManager.setOnline(true);
    await signInPanelClient();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    onlineManager.setOnline(true);
  });

  describe("the top bar button", () => {
    it("should open the panel, and close it again, as a button that says whether it is open", async () => {
      const user = userEvent.setup();
      await renderApp();
      expect(assistantButton().getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByRole("dialog", { name: ASSISTANT_SHEET.title })).toBeNull();

      await user.click(assistantButton());

      expect(panel()).toBeTruthy();
      expect(assistantButton().getAttribute("aria-expanded")).toBe("true");

      await user.click(assistantButton());

      expect(screen.queryByRole("dialog", { name: ASSISTANT_SHEET.title })).toBeNull();
      expect(assistantButton().getAttribute("aria-expanded")).toBe("false");
    });

    it("should close from the Close button in the panel's header", async () => {
      const user = userEvent.setup();
      await renderApp();
      await user.click(assistantButton());

      await user.click(within(panel()).getByRole("button", { name: ASSISTANT_SHEET.closeLabel }));

      expect(screen.queryByRole("dialog", { name: ASSISTANT_SHEET.title })).toBeNull();
    });

    it("should close on Escape and give focus back to the Assistant button", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog", { name: ASSISTANT_SHEET.title })).toBeNull();
      expect(document.activeElement).toBe(assistantButton());
    });

    it("should move focus to the field when the panel opens", async () => {
      const user = userEvent.setup();
      await renderApp();

      await user.click(assistantButton());

      await waitFor(() => {
        expect(document.activeElement).toBe(field());
      });
    });
  });

  describe("the frame", () => {
    it("should be a modal dialog below the large breakpoint", async () => {
      const user = userEvent.setup();
      await renderApp();

      await user.click(assistantButton());

      expect(panel().getAttribute("aria-modal")).toBe("true");
    });

    it("should keep Tab inside the sheet while it is modal", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      const close = within(panel()).getByRole("button", { name: ASSISTANT_SHEET.closeLabel });
      close.focus();

      await user.tab();
      expect(panel().contains(document.activeElement)).toBe(true);
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });

      expect(panel().contains(document.activeElement)).toBe(true);
    });

    it("should be a complementary region, not modal, at the large breakpoint", async () => {
      setWindowWidth(1280);
      const user = userEvent.setup();
      await renderApp();

      await user.click(assistantButton());

      const docked = screen.getByRole("complementary", { name: ASSISTANT_SHEET.title });
      expect(docked.getAttribute("aria-modal")).toBeNull();
      expect(screen.getByRole("heading", { name: "The page" })).toBeTruthy();
    });

    it("should take no room on the page while it is closed, though it stays mounted", async () => {
      const user = userEvent.setup();
      await renderApp();
      await user.click(assistantButton());
      await user.click(assistantButton());

      const closed = screen.getByRole("dialog", { hidden: true });

      // The display classes are Tailwind's, which jsdom does not load, so the classes are what is read.
      expect(closed.classList.contains("hidden")).toBe(true);
      expect(closed.classList.contains("flex")).toBe(false);
    });

    it("should stay mounted when it is closed, so what was typed is still there when it opens again", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.type(field(), "half a thought");

      await user.click(assistantButton());
      await user.click(assistantButton());

      expect((field() as HTMLTextAreaElement).value).toBe("half a thought");
    });
  });

  describe("closing", () => {
    it("should give focus back to the Assistant button when the Close button closes the panel", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.click(within(panel()).getByRole("button", { name: ASSISTANT_SHEET.closeLabel }));

      expect(document.activeElement).toBe(assistantButton());
    });

    it("should give focus back to the Assistant button when Not now closes the consent card", async () => {
      panelBackend.isConsentGiven = false;
      const user = userEvent.setup();
      await renderApp();
      await user.click(assistantButton());
      await user.click(
        await screen.findByRole("button", { name: ASSISTANT_CONSENT_CARD.notNowLabel }),
      );

      expect(document.activeElement).toBe(assistantButton());
    });

    it("should stop the page behind scrolling while the sheet is open, and let it scroll again once it is closed", async () => {
      const user = userEvent.setup();
      await renderApp();
      expect(document.body.style.overflow).toBe("");

      await user.click(assistantButton());
      expect(document.body.style.overflow).toBe("hidden");

      await user.click(within(panel()).getByRole("button", { name: ASSISTANT_SHEET.closeLabel }));
      expect(document.body.style.overflow).toBe("");
    });

    it("should leave the page scrolling beside the docked panel", async () => {
      setWindowWidth(1280);
      const user = userEvent.setup();
      await renderApp();

      await user.click(assistantButton());

      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("the docked panel's top", () => {
    const pageTop = (top: number) =>
      vi
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(() => ({ top }) as DOMRect);
    const panelTop = () =>
      screen
        .getByRole("complementary", { name: ASSISTANT_SHEET.title })
        .style.getPropertyValue("--assistant-top");

    it("should start under the top bar, and follow it out of view as the page scrolls, so no gap shows above it", async () => {
      setWindowWidth(1280);
      const rect = pageTop(65);
      const user = userEvent.setup();
      await renderApp();

      await user.click(assistantButton());
      expect(panelTop()).toBe("65px");

      rect.mockImplementation(() => ({ top: 20 }) as DOMRect);
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      expect(panelTop()).toBe("20px");

      rect.mockImplementation(() => ({ top: -400 }) as DOMRect);
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      expect(panelTop()).toBe("0px");
    });
  });

  describe("while a reply streams", () => {
    async function startStreamedReply(user: ReturnType<typeof userEvent.setup>) {
      const stream = controlledStream();
      panelBackend.answerTurn = () => stream.response;
      const app = await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      stream.push(turnEvent + eventText({ type: "text", delta: "First part" }));
      await screen.findByRole("group", { name: "Assistant: First part" });
      return { stream, app };
    }

    it("should not stop it when the page changes under the open panel", async () => {
      const user = userEvent.setup();
      const { stream, app } = await startStreamedReply(user);

      app.goTo("/train");
      stream.push(eventText({ type: "text", delta: " and more" }));

      expect(
        await screen.findByRole("group", { name: "Assistant: First part and more" }),
      ).toBeTruthy();
      expect(screen.queryByText(ASSISTANT_STOPPED.label)).toBeNull();
    });

    it("should not stop it when the window crosses the large breakpoint", async () => {
      const user = userEvent.setup();
      const { stream } = await startStreamedReply(user);

      resizeWindow(1280);
      expect(screen.getByRole("complementary", { name: ASSISTANT_SHEET.title })).toBeTruthy();
      stream.push(eventText({ type: "text", delta: " and more" }));

      expect(
        await screen.findByRole("group", { name: "Assistant: First part and more" }),
      ).toBeTruthy();
      expect(screen.queryByText(ASSISTANT_STOPPED.label)).toBeNull();
    });
  });

  describe("the empty state", () => {
    it("should show the diary's words, the starters and the not-medical line", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");
      await openPanel(user);

      expect(screen.getByRole("heading", { name: ASSISTANT_SHEET.emptyHeading })).toBeTruthy();
      const starters = within(screen.getByRole("region", { name: ASSISTANT_SHEET.startersLabel }));
      expect(starters.getAllByRole("button").map((starter) => starter.textContent)).toEqual([
        ...ASSISTANT_SHEET.starters,
      ]);
      expect(screen.getByText(ASSISTANT_NOT_MEDICAL_ADVICE)).toBeTruthy();
      expect(field().getAttribute("placeholder")).toBe(ASSISTANT_SHEET.composerPlaceholder);
    });

    it("should show the training words when it is opened from a Train page", async () => {
      const user = userEvent.setup();
      await renderApp("/train/history");
      await openPanel(user);

      expect(
        screen.getByRole("heading", { name: ASSISTANT_TRAIN_SHEET.emptyHeading }),
      ).toBeTruthy();
      expect(field().getAttribute("placeholder")).toBe(ASSISTANT_TRAIN_SHEET.composerPlaceholder);
    });

    it("should say what Enter does under the field", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      expect(screen.getByText(ASSISTANT_SHEET.composerKeyboardHint)).toBeTruthy();
    });

    it("should stand in a loading placeholder until the conversation is read", async () => {
      let release = () => undefined;
      panelBackend.statusGate = new Promise((resolve) => {
        release = () => {
          resolve();
        };
      });
      const user = userEvent.setup();
      await renderApp();

      await user.click(assistantButton());

      expect(screen.getByRole("status", { name: ASSISTANT_SHEET.openingLabel })).toBeTruthy();
      release();
      await screen.findByRole("region", { name: ASSISTANT_SHEET.startersLabel });
      expect(screen.queryByRole("status", { name: ASSISTANT_SHEET.openingLabel })).toBeNull();
    });
  });

  describe("consent", () => {
    beforeEach(() => {
      panelBackend.isConsentGiven = false;
    });

    async function openOnConsent(user: ReturnType<typeof userEvent.setup>) {
      await user.click(assistantButton());
      await screen.findByRole("button", { name: ASSISTANT_CONSENT_CARD.turnOnLabel });
    }

    it("should show the consent card, with no field, before the assistant is turned on", async () => {
      const user = userEvent.setup();
      await renderApp();

      await openOnConsent(user);

      expect(screen.getByText(ASSISTANT_CONSENT_CARD.title)).toBeTruthy();
      for (const paragraph of ASSISTANT_CONSENT_CARD.paragraphs) {
        expect(screen.getByText(paragraph)).toBeTruthy();
      }
      expect(screen.getByText(ASSISTANT_CONSENT_CARD.smallPrint)).toBeTruthy();
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(
        screen
          .getByRole("button", { name: ASSISTANT_SHEET.newConversationLabel })
          .hasAttribute("disabled"),
      ).toBe(true);
    });

    it("should link to the Privacy policy in a new tab, so the conversation is not left", async () => {
      const user = userEvent.setup();
      await renderApp();

      await openOnConsent(user);

      const link = screen.getByRole("link", { name: ASSISTANT_CONSENT_CARD.privacyLinkLabel });
      expect(link.getAttribute("href")).toBe(LEGAL_PATHS.privacy);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("should close on Not now", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openOnConsent(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_CONSENT_CARD.notNowLabel }));

      expect(screen.queryByRole("dialog", { name: ASSISTANT_SHEET.title })).toBeNull();
    });

    it("should turn the assistant on with Turn on, and then show the empty state", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openOnConsent(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_CONSENT_CARD.turnOnLabel }));

      await screen.findByRole("heading", { name: ASSISTANT_SHEET.emptyHeading });
      expect(panelBackend.isConsentGiven).toBe(true);
      expect(screen.queryByText(ASSISTANT_CONSENT_CARD.title)).toBeNull();
      expect(field()).toBeTruthy();
    });

    it("should say so in a toast at the top when turning it on fails, and keep the card", async () => {
      panelBackend.consentWriteFails = true;
      const user = userEvent.setup();
      await renderApp();
      await openOnConsent(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_CONSENT_CARD.turnOnLabel }));

      expect(await screen.findByText(SAVE_FAILED_BANNER)).toBeTruthy();
      expect(screen.getByText(ASSISTANT_CONSENT_CARD.title)).toBeTruthy();
      await waitFor(() => {
        expect(
          screen
            .getByRole("button", { name: ASSISTANT_CONSENT_CARD.turnOnLabel })
            .hasAttribute("disabled"),
        ).toBe(false);
      });
    });

    it("should not let Turn on be pressed offline, and say the assistant needs a connection", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openOnConsent(user);

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByText(ASSISTANT_OFFLINE.title)).toBeTruthy();
      expect(
        screen
          .getByRole("button", { name: ASSISTANT_CONSENT_CARD.turnOnLabel })
          .hasAttribute("disabled"),
      ).toBe(true);
    });
  });

  describe("sending", () => {
    it("should send a starter at once, and draw your message and the streamed answer", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      expect(await screen.findByRole("group", { name: "Assistant: Hello there" })).toBeTruthy();
      expect(
        screen.getByRole("group", {
          name: `${ASSISTANT_SHEET.speakerYou}: ${ASSISTANT_SHEET.starters[1]}`,
        }),
      ).toBeTruthy();
      expect(panelBackend.turnRequests.map(({ text }) => text)).toEqual([
        ASSISTANT_SHEET.starters[1],
      ]);
      expect(screen.queryByRole("heading", { name: ASSISTANT_SHEET.emptyHeading })).toBeNull();
    });

    it("should send what is typed on Enter, and clear the field", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.type(field(), "What did I eat?{Enter}");

      await screen.findByRole("group", { name: "Assistant: Hello there" });
      expect(panelBackend.turnRequests.map(({ text }) => text)).toEqual(["What did I eat?"]);
      expect((field() as HTMLTextAreaElement).value).toBe("");
    });

    it("should add a line on Shift and Enter and send nothing", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.type(field(), "first{Shift>}{Enter}{/Shift}second");

      expect((field() as HTMLTextAreaElement).value).toBe("first\nsecond");
      expect(panelBackend.turnRequests).toEqual([]);
    });

    it("should send with the Send button, which is off until there are words", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      expect(sendButton().hasAttribute("disabled")).toBe(true);

      await user.type(field(), "Hello");
      expect(sendButton().hasAttribute("disabled")).toBe(false);
      await user.click(sendButton());

      await screen.findByRole("group", { name: "Assistant: Hello there" });
      expect(panelBackend.turnRequests.map(({ text }) => text)).toEqual(["Hello"]);
    });

    it("should send on the day the diary is showing", async () => {
      viewedDate.mockReturnValue("2026-10-20");
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      await screen.findByRole("group", { name: "Assistant: Hello there" });
      expect(panelBackend.turnRequests.map(({ localDate }) => localDate)).toEqual(["2026-10-20"]);
    });

    it("should send on today in the profile's time zone when no day is on view", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-27T23:30:00Z"));
      panelBackend.timeZone = "Pacific/Auckland";
      const user = userEvent.setup({ advanceTimers: () => undefined });
      await renderApp();
      await openPanel(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      await screen.findByRole("group", { name: "Assistant: Hello there" });
      expect(panelBackend.turnRequests.map(({ localDate }) => localDate)).toEqual(["2026-10-28"]);
    });

    it("should turn the field and Send off offline, and say the assistant needs a connection", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByText(ASSISTANT_OFFLINE.title)).toBeTruthy();
      expect(screen.getByText(ASSISTANT_OFFLINE.body)).toBeTruthy();
      expect(sendButton().hasAttribute("disabled")).toBe(true);
      expect(field().hasAttribute("disabled")).toBe(true);
      expect(
        within(screen.getByRole("region", { name: ASSISTANT_SHEET.startersLabel }))
          .getAllByRole("button")
          .every(
            (starter) =>
              starter.hasAttribute("disabled") || starter.getAttribute("aria-disabled") === "true",
          ),
      ).toBe(true);
    });
  });

  describe("the answer", () => {
    it("should draw the reply's markdown as formatting", async () => {
      panelBackend.answerTurn = () =>
        turnResponse(replyEvents("You have **1,693 kcal** left, ", "so *plenty*."));
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      await screen.findByRole("group", { name: "Assistant: You have 1,693 kcal left, so plenty." });
      expect(screen.getByText("1,693 kcal").tagName).toBe("STRONG");
      expect(screen.getByText("plenty").tagName).toBe("EM");
    });

    it("should show the step the assistant is on as the working line, and announce only the first step", async () => {
      panelBackend.answerTurn = () =>
        openTurnResponse(
          eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
            eventText({
              type: "status",
              code: "tool",
              tool: "search_foods",
              food: "toast",
              isConfirmed: false,
            }),
        );
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      // The line holds each step for 700 ms, then shows the next. A screen reader is told the first step on
      // mounting and the later ones only after 5 seconds, so it hears one step here.
      await screen.findByText("Looking up toast", undefined, { timeout: 3000 });
      expect(screen.getAllByText("Thinking")).toHaveLength(1);
      expect(screen.getAllByText("Looking up toast")).toHaveLength(1);
    });

    it("should announce the finished answer once, in a polite live region, and not while it streams", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      await waitFor(() => {
        expect(
          screen.getAllByRole("status").filter((region) => region.textContent === "Hello there"),
        ).toHaveLength(1);
      });
      const region = screen
        .getAllByRole("status")
        .filter((candidate) => candidate.textContent === "Hello there")[0];
      expect(region?.getAttribute("aria-live")).toBe("polite");
    });

    it("should keep a reply that was cut short by closing the panel, marked stopped", async () => {
      panelBackend.answerTurn = () => stoppedStream("Yesterday you logged 8 entries");
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      await screen.findByRole("group", { name: "Assistant: Yesterday you logged 8 entries" });

      await user.click(within(panel()).getByRole("button", { name: ASSISTANT_SHEET.closeLabel }));
      await user.click(assistantButton());

      expect(
        await screen.findByRole("group", {
          name: `Assistant: Yesterday you logged 8 entries ${ASSISTANT_STOPPED.label}`,
        }),
      ).toBeTruthy();
    });

    it("should stop a reply that is arriving when the top bar's button closes the panel", async () => {
      panelBackend.answerTurn = () => stoppedStream("Yesterday you logged 8 entries");
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      await screen.findByRole("group", { name: "Assistant: Yesterday you logged 8 entries" });

      await user.click(assistantButton());
      await user.click(assistantButton());

      expect(
        await screen.findByRole("group", {
          name: `Assistant: Yesterday you logged 8 entries ${ASSISTANT_STOPPED.label}`,
        }),
      ).toBeTruthy();
    });

    it("should leave the field on and Send off while an answer arrives", async () => {
      panelBackend.answerTurn = () => stoppedStream("Yesterday");
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      await screen.findByRole("group", { name: "Assistant: Yesterday" });

      await user.type(field(), "next");

      expect(field().hasAttribute("disabled")).toBe(false);
      expect(sendButton().hasAttribute("disabled")).toBe(true);
    });
  });

  describe("a new conversation", () => {
    it("should be off while the conversation is empty", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      expect(
        screen
          .getByRole("button", { name: ASSISTANT_SHEET.newConversationLabel })
          .hasAttribute("disabled"),
      ).toBe(true);
    });

    it("should start a new conversation and show the empty state again", async () => {
      panelBackend.storedTurns = [{ userText: "What's left?", assistantText: "1,693 kcal left." }];
      const user = userEvent.setup();
      await renderApp();
      await user.click(assistantButton());
      await screen.findByRole("group", { name: "Assistant: 1,693 kcal left." });

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.newConversationLabel }));

      await screen.findByRole("heading", { name: ASSISTANT_SHEET.emptyHeading });
      expect(panelBackend.newConversationRequests).toBe(1);
    });

    describe.each([
      { name: "docked", width: 1280 },
      { name: "a modal sheet", width: 375 },
    ])("when it is $name", ({ width }) => {
      it("should move focus to the field after a new conversation, so Escape closes the panel and focus returns to the Assistant button", async () => {
        setWindowWidth(width);
        panelBackend.storedTurns = [
          { userText: "What's left?", assistantText: "1,693 kcal left." },
        ];
        const user = userEvent.setup();
        await renderApp();
        await user.click(assistantButton());
        await screen.findByRole("group", { name: "Assistant: 1,693 kcal left." });

        await user.click(
          screen.getByRole("button", { name: ASSISTANT_SHEET.newConversationLabel }),
        );
        await screen.findByRole("heading", { name: ASSISTANT_SHEET.emptyHeading });

        await waitFor(() => {
          expect(document.activeElement).toBe(field());
        });
        await user.keyboard("{Escape}");

        await waitFor(() => {
          expect(document.activeElement).toBe(assistantButton());
        });
        expect(assistantButton().getAttribute("aria-expanded")).toBe("false");
      });
    });
  });

  describe("following the end of the thread", () => {
    // jsdom has no layout, so the thread is 1000 tall in a 400 window, and every write to its scroll position is kept.
    const sizeThread = (thread: HTMLElement) => {
      let top = 0;
      const writes: number[] = [];
      Object.defineProperties(thread, {
        scrollHeight: { configurable: true, value: 1000 },
        clientHeight: { configurable: true, value: 400 },
        scrollTop: {
          configurable: true,
          get: () => top,
          set: (next: number) => {
            top = next;
            writes.push(next);
          },
        },
      });
      // The person's own scroll moves the thread and says so, and is not one of the panel's writes.
      const scrollUpTo = (next: number) => {
        top = next;
        act(() => {
          thread.dispatchEvent(new Event("scroll"));
        });
      };
      return { writes, scrollUpTo };
    };

    it("should scroll to the end as the thread grows", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      const { writes } = sizeThread(screen.getByRole("log"));

      await user.type(field(), "Hello{Enter}");
      await screen.findByRole("group", { name: "Assistant: Hello there" });

      expect(writes.at(-1)).toBe(1000);
    });

    it("should leave a person who scrolled up while the answer grows where they are", async () => {
      const stream = controlledStream();
      panelBackend.answerTurn = () => stream.response;
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      const thread = screen.getByRole("log");
      const { writes, scrollUpTo } = sizeThread(thread);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      stream.push(turnEvent + eventText({ type: "text", delta: "First part" }));
      await screen.findByRole("group", { name: "Assistant: First part" });

      scrollUpTo(100);
      const writesBefore = writes.length;
      stream.push(eventText({ type: "text", delta: " and more" }));
      await screen.findByRole("group", { name: "Assistant: First part and more" });

      expect(writes).toHaveLength(writesBefore);
    });
  });

  describe("quick replies and confirmation", () => {
    const clarifyEvents = (): AssistantStreamEvent[] => [
      { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
      { type: "text", delta: "How much chicken and how much rice?" },
      {
        type: "clarify",
        question: "How much chicken and how much rice?",
        quickReplies: ["1 chicken breast, 150 g rice", "1 chicken breast, 200 g rice"],
        fieldHint: null,
      },
      { type: "done", outcome: "clarify" },
    ];
    const confirmEvent = (tone: "danger" | "primary"): AssistantStreamEvent => ({
      type: "confirm",
      confirmationId: CONFIRMATION_ID,
      question: "Delete 3 entries at 13:00 today?",
      confirmLabel: "Delete 3 entries",
      cancelLabel: "Keep them",
      tone,
    });
    const quickReplies = () =>
      screen.findByRole("group", { name: ASSISTANT_SHEET.quickRepliesLabel });

    it("should send a quick reply's words as your message", async () => {
      panelBackend.answerTurn = () => turnResponse(clarifyEvents());
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      const replies = await quickReplies();

      const chip = within(replies).getByRole("button", { name: "1 chicken breast, 200 g rice" });
      await waitFor(() => {
        expect(chip.hasAttribute("disabled")).toBe(false);
      });
      await user.click(chip);

      await waitFor(() => {
        expect(panelBackend.turnRequests.map(({ text }) => text)).toEqual([
          ASSISTANT_SHEET.starters[1],
          "1 chicken breast, 200 g rice",
        ]);
      });
    });

    it.each([
      ["danger", "destructive", "primary"],
      ["primary", "primary", "destructive"],
    ] as const)(
      "should send the confirm button's label, drawn in the %s tone",
      async (tone, variant, otherVariant) => {
        panelBackend.answerTurn = () =>
          turnResponse([
            { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
            { type: "text", delta: "Delete 3 entries at 13:00 today?" },
            confirmEvent(tone),
            { type: "done", outcome: "confirm" },
          ]);
        const user = userEvent.setup();
        await renderApp();
        await openPanel(user);
        await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
        const confirm = await screen.findByRole("button", { name: "Delete 3 entries" });

        // The classes the tone's variant has and the other one lacks, so the check follows the Button's own looks.
        const otherClasses = buttonVariants({ variant: otherVariant }).split(" ");
        const toneClasses = buttonVariants({ variant })
          .split(" ")
          .filter((name) => !otherClasses.includes(name));
        expect(toneClasses.length).toBeGreaterThan(0);
        expect(confirm.className.split(" ")).toEqual(expect.arrayContaining(toneClasses));
        await waitFor(() => {
          expect(confirm.hasAttribute("disabled")).toBe(false);
        });
        await user.click(confirm);

        await waitFor(() => {
          expect(panelBackend.turnRequests.map(({ text }) => text).at(-1)).toBe("Delete 3 entries");
        });
      },
    );

    it("should keep the quick replies off while the turn streams and on when it ends", async () => {
      const stream = controlledStream();
      panelBackend.answerTurn = () => stream.response;
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      stream.push(
        turnEvent +
          eventText({
            type: "clarify",
            question: "How much?",
            quickReplies: ["150 g", "200 g"],
            fieldHint: null,
          }),
      );

      const chip = await screen.findByRole("button", { name: "150 g" });
      expect(chip.hasAttribute("disabled")).toBe(true);

      stream.push(eventText({ type: "done", outcome: "clarify" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "150 g" }).hasAttribute("disabled")).toBe(false);
      });
    });

    it("should send the cancel label when it is pressed", async () => {
      panelBackend.answerTurn = () =>
        turnResponse([
          { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
          { type: "text", delta: "Delete 3 entries at 13:00 today?" },
          confirmEvent("danger"),
          { type: "done", outcome: "confirm" },
        ]);
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      const cancel = await screen.findByRole("button", { name: "Keep them" });
      await waitFor(() => {
        expect(cancel.hasAttribute("disabled")).toBe(false);
      });
      await user.click(cancel);

      await waitFor(() => {
        expect(panelBackend.turnRequests.map(({ text }) => text).at(-1)).toBe("Keep them");
      });
    });

    it("should keep the buttons off while the turn streams and on when it ends", async () => {
      const stream = controlledStream();
      panelBackend.answerTurn = () => stream.response;
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      stream.push(turnEvent + eventText(confirmEvent("danger")));

      const confirm = await screen.findByRole("button", { name: "Delete 3 entries" });
      expect(confirm.hasAttribute("disabled")).toBe(true);
      expect(screen.getByRole("button", { name: "Keep them" }).hasAttribute("disabled")).toBe(true);

      stream.push(eventText({ type: "done", outcome: "confirm" }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Delete 3 entries" }).hasAttribute("disabled"),
        ).toBe(false);
        expect(screen.getByRole("button", { name: "Keep them" }).hasAttribute("disabled")).toBe(
          false,
        );
      });
    });

    it("should draw the Estimate badge and the citation under the answer", async () => {
      panelBackend.answerTurn = () =>
        turnResponse([
          { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
          { type: "text", delta: "Your trend weight fell by 0.4 kg a week." },
          {
            type: "answer_meta",
            citation: "Based on 24 weigh-ins, 21 Sep to 18 Oct",
            estimate: "Trend weight is an estimate",
          },
          { type: "done", outcome: "complete" },
        ]);
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      expect(await screen.findByText("Trend weight is an estimate")).toBeTruthy();
      expect(screen.getByText("Estimate")).toBeTruthy();
      expect(screen.getByText("Based on 24 weigh-ins, 21 Sep to 18 Oct")).toBeTruthy();
    });
  });

  describe("older turns", () => {
    // 45 stored turns, so the panel opens on the newest 20 and two older pages follow. "Question 44" is the newest.
    const storeFortyFiveTurns = () => {
      panelBackend.storedTurns = Array.from({ length: 45 }, (_unused, index) => ({
        userText: `Question ${index}`,
        assistantText: `Answer ${index}`,
      }));
    };

    // jsdom has no layout, so a message is 100 tall above a 1000 base in a 400 window, and every write to the
    // thread's scroll position is kept. It is set on the element's prototype, so it is in place before the
    // thread first draws, and only the thread (the log) is changed.
    const MESSAGE_HEIGHT = 100;
    const PLACEHOLDER_BONES_HEIGHT = 220;
    // A browser fires the scroll event on a later frame, not in the write.
    const SCROLL_EVENT_DELAY_MS = 20;
    let restoreThreadSize = () => {};
    afterEach(() => {
      restoreThreadSize();
    });

    const sizeGrowingThreads = ({ base = 1000, messageHeight = MESSAGE_HEIGHT } = {}) => {
      let top = 0;
      const writes: number[] = [];
      // Scroll events the writes have caused that were not yet fired.
      let pendingScrollEvents = 0;
      const isThread = (element: Element) => element.getAttribute("role") === "log";
      // The placeholder's bones show a moment after it does, and are 220 tall.
      const heightOf = (thread: Element) =>
        base +
        messageHeight * thread.querySelectorAll('[role="group"]').length +
        (thread.querySelector('[role="status"]')?.childElementCount ? PLACEHOLDER_BONES_HEIGHT : 0);
      const originals = {
        scrollHeight: Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight"),
        clientHeight: Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight"),
        scrollTop: Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop"),
      };
      Object.defineProperties(Element.prototype, {
        scrollHeight: {
          configurable: true,
          get(this: Element) {
            return isThread(this) ? heightOf(this) : 0;
          },
        },
        clientHeight: {
          configurable: true,
          get(this: Element) {
            return isThread(this) ? 400 : 0;
          },
        },
        scrollTop: {
          configurable: true,
          get(this: Element) {
            return isThread(this) ? top : 0;
          },
          set(this: Element, next: number) {
            if (isThread(this)) {
              const isMoved = next !== top;
              top = next;
              writes.push(next);
              // A browser says so, after the write, when the write moved the thread.
              if (isMoved) {
                pendingScrollEvents += 1;
                setTimeout(() => {
                  pendingScrollEvents -= 1;
                  this.dispatchEvent(new Event("scroll"));
                }, SCROLL_EVENT_DELAY_MS);
              }
            }
          },
        },
      });
      restoreThreadSize = () => {
        Object.entries(originals).forEach(([name, descriptor]) => {
          if (descriptor !== undefined) {
            Object.defineProperty(Element.prototype, name, descriptor);
          }
        });
      };
      // The person's own scroll moves the thread and says so, and is not one of the panel's writes.
      const scrollUpTo = (next: number) => {
        top = next;
        act(() => {
          screen.getByRole("log").dispatchEvent(new Event("scroll"));
        });
      };
      // A scroll event reads where the thread is when it fires, so one still to come would read the person's
      // scroll as its own position. A test waits for them before it scrolls.
      const settleScrollEvents = () =>
        waitFor(() => {
          expect(pendingScrollEvents).toBe(0);
        });
      return {
        writes,
        scrollUpTo,
        settleScrollEvents,
        heightNow: () => heightOf(screen.getByRole("log")),
        topNow: () => top,
      };
    };

    async function openOnFortyFiveTurns(size?: { base: number; messageHeight: number }) {
      storeFortyFiveTurns();
      const sized = sizeGrowingThreads(size);
      const user = userEvent.setup();
      await renderApp();
      await user.click(assistantButton());
      await screen.findByText("Question 44");
      await sized.settleScrollEvents();
      return sized;
    }

    it("should open at the newest message, 20 turns of 45", async () => {
      const { writes, heightNow } = await openOnFortyFiveTurns();

      expect(writes.at(-1)).toBe(heightNow());
      expect(screen.getByText("Question 25")).toBeTruthy();
      expect(screen.queryByText("Question 24")).toBeNull();
      expect(panelBackend.olderPageRequests).toBe(0);
    });

    it("should load the next 20 when the person scrolls to within 300 px of the top", async () => {
      const { scrollUpTo } = await openOnFortyFiveTurns();

      scrollUpTo(300);

      await screen.findByText("Question 5");
      expect(screen.getByText("Question 24")).toBeTruthy();
      expect(screen.queryByText("Question 4")).toBeNull();
      expect(panelBackend.olderPageRequests).toBe(1);
    });

    it("should not load older turns while the person is further than 300 px from the top", async () => {
      const { scrollUpTo } = await openOnFortyFiveTurns();

      scrollUpTo(301);
      // A read would have started by now, and a negative needs the time to pass.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(panelBackend.olderPageRequests).toBe(0);
    });

    it("should not load older turns from the panel's own scroll to the end", async () => {
      const { writes } = await openOnFortyFiveTurns();

      expect(writes.length).toBeGreaterThan(0);
      expect(panelBackend.olderPageRequests).toBe(0);
    });

    it("should show the loading placeholder above the turns while older ones load, and then take it away", async () => {
      let release = () => {};
      panelBackend.olderPageGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const { scrollUpTo } = await openOnFortyFiveTurns();

      scrollUpTo(100);

      const placeholder = await screen.findByRole("status", { name: ASSISTANT_SHEET.openingLabel });
      expect(
        within(screen.getByRole("log")).getByRole("status", { name: ASSISTANT_SHEET.openingLabel }),
      ).toBe(placeholder);
      release();
      await screen.findByText("Question 5");
      expect(screen.queryByRole("status", { name: ASSISTANT_SHEET.openingLabel })).toBeNull();
    });

    it("should not load twice while a page is loading", async () => {
      let release = () => {};
      panelBackend.olderPageGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const { scrollUpTo } = await openOnFortyFiveTurns();

      scrollUpTo(100);
      await screen.findByRole("status", { name: ASSISTANT_SHEET.openingLabel });
      scrollUpTo(50);
      scrollUpTo(10);
      release();
      await screen.findByText("Question 5");

      expect(panelBackend.olderPageRequests).toBe(1);
    });

    it("should keep the view where it was when the older turns arrive above it", async () => {
      let release = () => {};
      panelBackend.olderPageGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const { scrollUpTo, topNow, heightNow } = await openOnFortyFiveTurns();
      scrollUpTo(100);
      await screen.findByRole("status", { name: ASSISTANT_SHEET.openingLabel });
      const distanceFromBottomWhileLoading = heightNow() - 400 - topNow();

      release();
      await screen.findByText("Question 5");

      expect(heightNow() - 400 - topNow()).toBe(distanceFromBottomWhileLoading);
    });

    it("should keep the distance from the bottom across the placeholder appearing", async () => {
      panelBackend.olderPageGate = new Promise<void>(() => {});
      const { scrollUpTo, topNow, heightNow } = await openOnFortyFiveTurns();
      const distanceBefore = heightNow() - 400 - 100;

      scrollUpTo(100);
      await screen.findByRole("status", { name: ASSISTANT_SHEET.openingLabel });

      expect(heightNow() - 400 - topNow()).toBe(distanceBefore);
    });

    it("should keep the view in place when the placeholder's bones show, after it did", async () => {
      const resizeCallbacks: Array<() => void> = [];
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(callback: () => void) {
            resizeCallbacks.push(callback);
          }
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
      panelBackend.olderPageGate = new Promise<void>(() => {});
      const { scrollUpTo, topNow, heightNow } = await openOnFortyFiveTurns();
      scrollUpTo(100);
      const placeholder = await screen.findByRole("status", { name: ASSISTANT_SHEET.openingLabel });
      const distanceBeforeBones = heightNow() - 400 - topNow();

      await waitFor(() => {
        expect(placeholder.childElementCount).toBeGreaterThan(0);
      });
      act(() => {
        resizeCallbacks.forEach((callback) => {
          callback();
        });
      });

      expect(heightNow() - 400 - topNow()).toBe(distanceBeforeBones);
    });

    it("should not read the panel's own scroll to the end as the person's, though it is at the top", async () => {
      // A thread of 200 in a 400 window, so the end the panel scrolls to is within 300 px of the top.
      await openOnFortyFiveTurns({ base: 200, messageHeight: 0 });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(panelBackend.olderPageRequests).toBe(0);
    });

    it("should stop following the end when the person scrolls near the top, though the end is within reach", async () => {
      let release = () => {};
      panelBackend.olderPageGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      // A thread of 400 in a 400 window, so the top is also the end, and 1 per message grows it when turns load.
      const { scrollUpTo, topNow, heightNow } = await openOnFortyFiveTurns({
        base: 360,
        messageHeight: 1,
      });
      scrollUpTo(0);
      await screen.findByRole("status", { name: ASSISTANT_SHEET.openingLabel });

      release();
      await screen.findByText("Question 5");

      // Still where the person was, with the thread's end where it was, not carried to the new end.
      expect(heightNow() - 400 - topNow()).toBe(0);
    });
  });
});
