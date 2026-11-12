import { KeyLowProvider } from "@keylow/api-client";
import { ASSISTANT_CONSENT_VERSION } from "@keylow/core";
import {
  ASSISTANT_CONSENT_CARD,
  ASSISTANT_DELETE_ALL_DIALOG,
  ASSISTANT_SETTINGS,
  DELETE_FAILED_BANNER,
  LEGAL_PATHS,
  SAVE_FAILED_BANNER,
  describeAssistantConsentCaption,
} from "@keylow/core/copy";
import { createClient } from "@supabase/supabase-js";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "../ui/appRouter";

import { AssistantSettingsPage } from "@/components/assistant/AssistantSettingsPage";
import { ToastProvider } from "@/components/ui/Toast";

const { router, changesRead } = vi.hoisted(() => ({
  router: { push: vi.fn<(href: string) => void>() },
  // What the changes list has read: the row on this page needs only its count.
  changesRead: { data: undefined as { count: number } | undefined },
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAssistantChanges: () => changesRead,
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

// The database as the page's real Supabase client meets it: every request is answered here, so what the page
// sends is what is checked, not what a hook was called with.
type Request = { method: string; path: string; query: string; body: unknown };
const database = {
  consentVersion: null as string | null,
  readIsHeld: false,
  writeIsHeld: false,
  writeFails: false,
  deleteFails: false,
  requests: [] as Request[],
  held: [] as Array<() => void>,
};

function resetDatabase() {
  database.consentVersion = null;
  database.readIsHeld = false;
  database.writeIsHeld = false;
  database.writeFails = false;
  database.deleteFails = false;
  database.requests = [];
  database.held = [];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const failure = () =>
  json({ code: "XX000", message: "database unavailable", details: null, hint: null }, 500);

function afterHold(isHeld: boolean, answer: () => Response): Promise<Response> {
  if (!isHeld) {
    return Promise.resolve(answer());
  }
  return new Promise((resolve) => {
    database.held.push(() => {
      resolve(answer());
    });
  });
}

async function fakeFetch(input: string | URL | globalThis.Request, init?: RequestInit) {
  const request = new globalThis.Request(input, init);
  const { pathname, search } = new URL(request.url);
  const text = await request.text();
  const body: unknown = text === "" ? undefined : JSON.parse(text);
  database.requests.push({ method: request.method, path: pathname, query: search, body });

  if (pathname.endsWith("/auth/v1/user")) {
    return json({ id: USER_ID, aud: "authenticated", role: "authenticated" });
  }
  if (pathname.endsWith("/profiles") && request.method === "GET") {
    return afterHold(database.readIsHeld, () =>
      json({
        assistant_consent_at: database.consentVersion === null ? null : "2026-11-12T10:00:00Z",
        assistant_consent_version: database.consentVersion,
      }),
    );
  }
  if (pathname.endsWith("/profiles") && request.method === "PATCH") {
    return afterHold(database.writeIsHeld, () => {
      if (database.writeFails) {
        return failure();
      }
      const version =
        typeof body === "object" && body !== null && "assistant_consent_version" in body
          ? body.assistant_consent_version
          : null;
      database.consentVersion = typeof version === "string" ? version : null;
      return json([{ id: USER_ID }]);
    });
  }
  if (pathname.endsWith("/assistant_conversations") && request.method === "DELETE") {
    return database.deleteFails ? failure() : json([]);
  }
  return json({ message: "unexpected request" }, 404);
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

const encodeSegment = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

async function signIn() {
  const accessToken = [
    encodeSegment({ alg: "HS256", typ: "JWT" }),
    encodeSegment({
      sub: USER_ID,
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    encodeSegment({ note: "unsigned" }),
  ].join(".");
  await client.auth.setSession({ access_token: accessToken, refresh_token: "test-refresh" });
}

function renderPage() {
  return renderWithRouter(
    <KeyLowProvider
      client={client}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ToastProvider>
        <AssistantSettingsPage />
      </ToastProvider>
    </KeyLowProvider>,
  );
}

const useSwitch = () => screen.getByRole("switch", { name: ASSISTANT_SETTINGS.useLabel });
const requestsTo = (method: string, pathEnd: string) =>
  database.requests.filter(({ method: m, path }) => m === method && path.endsWith(pathEnd));

async function renderRead(isOn = false) {
  database.consentVersion = isOn ? ASSISTANT_CONSENT_VERSION : null;
  const view = renderPage();
  await waitFor(() => {
    expect(useSwitch().getAttribute("aria-disabled")).toBeNull();
  });
  return view;
}

async function releaseHeldRequests() {
  await act(async () => {
    database.held.splice(0).forEach((release) => {
      release();
    });
    await Promise.resolve();
  });
}

describe("Assistant settings page", () => {
  beforeEach(async () => {
    resetDatabase();
    router.push.mockReset();
    changesRead.data = undefined;
    onlineManager.setOnline(true);
    await signIn();
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
  });

  describe("the frame", () => {
    it("should be titled Assistant, with a way back to More", async () => {
      await renderRead();

      expect(
        screen.getByRole("heading", { level: 1, name: ASSISTANT_SETTINGS.title }),
      ).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: ASSISTANT_SETTINGS.back }));
      expect(router.push).toHaveBeenCalledExactlyOnceWith("/more");
    });

    it("should say what it does in the consent card's words, with a Privacy policy link", async () => {
      await renderRead();

      const section = screen.getByRole("region", { name: ASSISTANT_SETTINGS.whatItDoes });
      for (const paragraph of ASSISTANT_CONSENT_CARD.paragraphs) {
        expect(within(section).getByText(paragraph)).toBeTruthy();
      }
      expect(
        within(section)
          .getByRole("link", { name: ASSISTANT_CONSENT_CARD.privacyLinkLabel })
          .getAttribute("href"),
      ).toBe(LEGAL_PATHS.privacy);
    });

    it("should draw What the assistant changed first in Your conversations, a link to its page", async () => {
      await renderRead(true);

      const group = within(
        screen.getByRole("region", { name: ASSISTANT_SETTINGS.yourConversations }),
      );
      const rows = group.getAllByRole("listitem");

      expect(rows[0]?.textContent).toContain(ASSISTANT_SETTINGS.changesRowLabel);
      expect(
        group
          .getByRole("link", { name: new RegExp(ASSISTANT_SETTINGS.changesRowLabel) })
          .getAttribute("href"),
      ).toBe("/more/assistant/changes");
      expect(rows[1]?.textContent).toBe(ASSISTANT_SETTINGS.deleteAllLabel);
    });

    it("should draw the row with the assistant off as well, so earlier changes can still be undone", async () => {
      await renderRead(false);

      expect(screen.getByRole("link", { name: /What the assistant changed/ })).toBeTruthy();
    });

    it("should show the number of changes as the row's value once it is read, and none before", async () => {
      await renderRead(true);
      const row = () => screen.getByRole("link", { name: /What the assistant changed/ });

      expect(row().textContent).toBe(ASSISTANT_SETTINGS.changesRowLabel);

      changesRead.data = { count: 5 };
      cleanup();
      await renderRead(true);

      expect(row().textContent).toBe(`${ASSISTANT_SETTINGS.changesRowLabel}5`);
    });
  });

  describe("before the setting is read", () => {
    it("should draw the page with the switch dimmed and no caption", () => {
      database.readIsHeld = true;
      renderPage();

      expect(useSwitch().getAttribute("aria-disabled")).toBe("true");
      expect(screen.queryByText(describeAssistantConsentCaption(false))).toBeNull();
      expect(
        screen.getByRole("heading", { level: 1, name: ASSISTANT_SETTINGS.title }),
      ).toBeTruthy();
      expect(screen.getByRole("region", { name: ASSISTANT_SETTINGS.whatItDoes })).toBeTruthy();
    });

    it("should ignore a press on the dimmed switch, so nothing is written", async () => {
      database.readIsHeld = true;
      renderPage();

      await userEvent.click(useSwitch());

      expect(requestsTo("PATCH", "/profiles")).toHaveLength(0);
    });

    it("should still draw the page, dimmed, when the read waits for a connection that does not come", () => {
      onlineManager.setOnline(false);
      renderPage();

      expect(useSwitch().getAttribute("aria-disabled")).toBe("true");
      expect(screen.getByRole("region", { name: ASSISTANT_SETTINGS.whatItDoes })).toBeTruthy();
      expect(screen.queryByRole("progressbar")).toBeNull();
    });
  });

  describe("the switch", () => {
    it("should be off with its caption when the assistant is off", async () => {
      await renderRead(false);

      expect(useSwitch().getAttribute("aria-checked")).toBe("false");
      expect(screen.getByText(describeAssistantConsentCaption(false))).toBeTruthy();
    });

    it("should be on with its caption when the assistant is on", async () => {
      await renderRead(true);

      expect(useSwitch().getAttribute("aria-checked")).toBe("true");
      expect(screen.getByText(describeAssistantConsentCaption(true))).toBeTruthy();
    });

    it("should write the consent time and the current version when turned on", async () => {
      await renderRead(false);

      await userEvent.click(useSwitch());

      await waitFor(() => {
        expect(useSwitch().getAttribute("aria-checked")).toBe("true");
      });
      const [write] = requestsTo("PATCH", "/profiles");
      const body = write?.body;
      expect(typeof body === "object" && body !== null && Object.keys(body).sort()).toEqual([
        "assistant_consent_at",
        "assistant_consent_version",
      ]);
      expect(typeof body === "object" && body !== null && "assistant_consent_at" in body).toBe(
        true,
      );
      expect(JSON.stringify(body)).toMatch(/"assistant_consent_at":"\d{4}-\d{2}-\d{2}T/);
      expect(JSON.stringify(body)).toContain(
        `"assistant_consent_version":"${ASSISTANT_CONSENT_VERSION}"`,
      );
      expect(write?.query).toContain(`id=eq.${USER_ID}`);
      expect(screen.getByText(describeAssistantConsentCaption(true))).toBeTruthy();
    });

    it("should clear both columns when turned off", async () => {
      await renderRead(true);

      await userEvent.click(useSwitch());

      await waitFor(() => {
        expect(useSwitch().getAttribute("aria-checked")).toBe("false");
      });
      expect(requestsTo("PATCH", "/profiles")[0]?.body).toEqual({
        assistant_consent_at: null,
        assistant_consent_version: null,
      });
    });

    it("should stay as it was, dimmed and ignoring presses, while the change is being saved", async () => {
      await renderRead(false);
      database.writeIsHeld = true;

      await userEvent.click(useSwitch());
      await userEvent.click(useSwitch());

      expect(useSwitch().getAttribute("aria-disabled")).toBe("true");
      expect(useSwitch().getAttribute("aria-checked")).toBe("false");
      expect(requestsTo("PATCH", "/profiles")).toHaveLength(1);
      database.writeIsHeld = false;
      await releaseHeldRequests();
      await waitFor(() => {
        expect(useSwitch().getAttribute("aria-checked")).toBe("true");
      });
      expect(useSwitch().getAttribute("aria-disabled")).toBeNull();
    });

    it("should dim the switch when the connection is lost after the read, so no write waits to land unseen", async () => {
      await renderRead(false);

      act(() => {
        onlineManager.setOnline(false);
      });
      expect(useSwitch().getAttribute("aria-disabled")).toBe("true");
      await userEvent.click(useSwitch());
      act(() => {
        onlineManager.setOnline(true);
      });

      await waitFor(() => {
        expect(useSwitch().getAttribute("aria-disabled")).toBeNull();
      });
      expect(requestsTo("PATCH", "/profiles")).toHaveLength(0);
      expect(useSwitch().getAttribute("aria-checked")).toBe("false");
    });

    it("should leave the switch as it was and say Not saved when the write is refused", async () => {
      await renderRead(false);
      database.writeFails = true;

      await userEvent.click(useSwitch());

      expect(await screen.findByText(SAVE_FAILED_BANNER)).toBeTruthy();
      expect(useSwitch().getAttribute("aria-checked")).toBe("false");
      expect(useSwitch().getAttribute("aria-disabled")).toBeNull();
      expect(screen.getByText(describeAssistantConsentCaption(false))).toBeTruthy();
    });

    it("should leave an on switch on when turning it off is refused", async () => {
      await renderRead(true);
      database.writeFails = true;

      await userEvent.click(useSwitch());

      expect(await screen.findByText(SAVE_FAILED_BANNER)).toBeTruthy();
      expect(useSwitch().getAttribute("aria-checked")).toBe("true");
    });
  });

  describe("Your conversations", () => {
    it("should be drawn with the assistant off as well as on, so Delete all conversations is always there", async () => {
      await renderRead(false);

      expect(
        screen.getByRole("region", { name: ASSISTANT_SETTINGS.yourConversations }),
      ).toBeTruthy();
      expect(screen.getByText(ASSISTANT_SETTINGS.deleteAllCaption)).toBeTruthy();
    });

    it("should ask first, and delete nothing when cancelled", async () => {
      await renderRead(true);

      await userEvent.click(
        screen.getByRole("button", { name: ASSISTANT_SETTINGS.deleteAllLabel }),
      );
      const dialog = screen.getByRole("dialog", { name: ASSISTANT_DELETE_ALL_DIALOG.title });
      expect(within(dialog).getByText(ASSISTANT_DELETE_ALL_DIALOG.body)).toBeTruthy();
      await userEvent.click(
        within(dialog).getByRole("button", { name: ASSISTANT_DELETE_ALL_DIALOG.cancelLabel }),
      );

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(requestsTo("DELETE", "/assistant_conversations")).toHaveLength(0);
    });

    it("should delete every conversation when confirmed, and close the dialog", async () => {
      await renderRead(true);

      await userEvent.click(
        screen.getByRole("button", { name: ASSISTANT_SETTINGS.deleteAllLabel }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: ASSISTANT_DELETE_ALL_DIALOG.confirmLabel }),
      );

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      const deletes = requestsTo("DELETE", "/assistant_conversations");
      expect(deletes).toHaveLength(1);
      expect(deletes[0]?.query).toBe("?id=not.is.null");
      expect(screen.queryByText(DELETE_FAILED_BANNER)).toBeNull();
    });

    it("should close the dialog and say Not deleted at the top when the delete fails", async () => {
      await renderRead(true);
      database.deleteFails = true;

      await userEvent.click(
        screen.getByRole("button", { name: ASSISTANT_SETTINGS.deleteAllLabel }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: ASSISTANT_DELETE_ALL_DIALOG.confirmLabel }),
      );

      expect(await screen.findByText(DELETE_FAILED_BANNER)).toBeTruthy();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("button", { name: ASSISTANT_SETTINGS.deleteAllLabel })).toBeTruthy();
    });
  });
});
