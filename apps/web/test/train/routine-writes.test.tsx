import { keys } from "@keylow/api-client";
import {
  ARCHIVE_ACTIVE_REFUSAL,
  ROUTINE_ARCHIVE_FAILED,
  ROUTINE_ARCHIVE_UNSAVED,
  ROUTINE_ARCHIVED_TOAST,
  ROUTINE_EDITOR,
  ROUTINE_MAKE_ACTIVE_FAILED,
  ROUTINE_RESTORE_FAILED,
  ROUTINES_ARCHIVED,
  ROUTINES_OFFLINE,
  ROUTINES_SCREEN,
  describeArchivedRoutinesLink,
  describeMakeActiveName,
  describeRestoreName,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUSH_PULL_LEGS_ID,
  STARTING_STRENGTH_ID,
  UPPER_LOWER_ID,
  flagsOf,
  renderWithRoutineWrites,
  resetWritesBackend,
  storedRoutine,
  writesBackend,
} from "./routineWritesBackend";

import { ArchivedRoutinesScreen } from "@/components/train/ArchivedRoutinesScreen";
import { RoutineEditor } from "@/components/train/RoutineEditor";
import { RoutineEditorScreen } from "@/components/train/RoutineEditorScreen";
import { RoutinesScreen } from "@/components/train/RoutinesScreen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const idOfOldSplit = "0000000a-0000-4000-8000-000000000009";
const NOW = new Date("2026-10-15T23:30:00Z");

const library = () => {
  writesBackend.routines = [
    storedRoutine(PUSH_PULL_LEGS_ID, "Push Pull Legs", {
      isActive: true,
      activatedAt: "2026-09-21T07:30:00+00:00",
    }),
    storedRoutine(UPPER_LOWER_ID, "Upper Lower"),
    storedRoutine(STARTING_STRENGTH_ID, "Starting strength", { isArchived: true }),
  ];
};

const makeActiveButton = (name: string) =>
  screen.getByRole("button", { name: describeMakeActiveName(name) });

const goOffline = () => {
  act(() => {
    onlineManager.setOnline(false);
  });
};

const descriptionOf = (control: HTMLElement): string =>
  (control.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
    .trim();

/** Holds every write until `release` is called. */
function holdWrites(): () => void {
  let release: () => void = () => undefined;
  writesBackend.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return () => {
    writesBackend.gate = null;
    release();
  };
}

/** Holds the read of the profile's zone until `release` is called. */
function holdZone(): () => void {
  let release: () => void = () => undefined;
  writesBackend.zoneGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return () => {
    writesBackend.zoneGate = null;
    release();
  };
}

beforeEach(() => {
  resetWritesBackend();
  router.push.mockReset();
  router.replace.mockReset();
  library();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  act(() => {
    onlineManager.setOnline(true);
  });
});

describe("making a routine active", () => {
  it("should name today in the profile's zone, not the device's", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    writesBackend.timeZone = "Pacific/Auckland";
    renderWithRoutineWrites(<RoutinesScreen />);

    await userEvent.click(await screen.findByRole("button", { name: /^Make active, Upper Lower/ }));

    const dialog = screen.getByRole("dialog", { name: "Make Upper Lower active?" });
    expect(within(dialog).getByText(/^It plans from today, Friday 16 October\./)).toBeTruthy();
    expect(within(dialog).getByText(/Push Pull Legs stays saved/)).toBeTruthy();
  });

  it("should change nothing on Cancel, and send nothing when the connection comes back", async () => {
    renderWithRoutineWrites(<RoutinesScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /^Make active, Upper Lower/ }));
    goOffline();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    act(() => {
      onlineManager.setOnline(true);
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(writesBackend.writes).toEqual([]);
    expect(flagsOf(PUSH_PULL_LEGS_ID).isActive).toBe(true);
  });

  it("should make the routine active on confirm and move it to the Active card", async () => {
    renderWithRoutineWrites(<RoutinesScreen />);

    await userEvent.click(await screen.findByRole("button", { name: /^Make active, Upper Lower/ }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Make active" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(writesBackend.writes).toEqual([`activate:${UPPER_LOWER_ID}`]);
    expect(await screen.findByRole("region", { name: /^Upper Lower, active/ })).toBeTruthy();
    expect(makeActiveButton("Push Pull Legs")).toBeTruthy();
  });

  it("should mark every training query stale, so the Train page's today card follows the new routine", async () => {
    const { queryClient } = renderWithRoutineWrites(<RoutinesScreen />);
    queryClient.setQueryData(keys.training.activeRoutine, { id: PUSH_PULL_LEGS_ID });
    await userEvent.click(await screen.findByRole("button", { name: /^Make active, Upper Lower/ }));

    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Make active" }),
    );

    await waitFor(() => {
      expect(queryClient.getQueryState(keys.training.activeRoutine)?.isInvalidated).toBe(true);
    });
  });

  it("should move focus to the Active card once the routine is made active, since the button pressed is gone", async () => {
    renderWithRoutineWrites(<RoutinesScreen onEditRoutine={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: /^Make active, Upper Lower/ }));

    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Make active" }),
    );

    const card = await screen.findByRole("button", { name: /^Upper Lower, active/ });
    await waitFor(() => {
      expect(document.activeElement).toBe(card);
    });
  });

  it("should move focus to the Active heading when the card is not a button", async () => {
    renderWithRoutineWrites(<RoutinesScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /^Make active, Upper Lower/ }));

    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Make active" }),
    );

    await screen.findByRole("region", { name: /^Upper Lower, active/ });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: ROUTINES_SCREEN.activeLabel }),
      );
    });
  });

  it("should not move focus when the write fails", async () => {
    writesBackend.failingWrites = true;
    renderWithRoutineWrites(<RoutinesScreen onEditRoutine={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: /^Make active, Upper Lower/ }));

    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Make active" }),
    );

    await screen.findByText(ROUTINE_MAKE_ACTIVE_FAILED);
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: /^Push Pull Legs, active/ }),
    );
  });

  it("should not draw Make active until the profile's zone is known", async () => {
    const release = holdZone();
    renderWithRoutineWrites(<RoutinesScreen />);

    await screen.findByRole("region", { name: ROUTINES_SCREEN.otherSectionName });
    expect(screen.queryByRole("button", { name: /^Make active/ })).toBeNull();
    release();

    expect(await screen.findByRole("button", { name: /^Make active, Upper Lower/ })).toBeTruthy();
  });

  it("should read a profile with no zone as UTC", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    writesBackend.timeZone = null;
    renderWithRoutineWrites(<RoutinesScreen />);

    await userEvent.click(await screen.findByRole("button", { name: /^Make active, Upper Lower/ }));

    expect(
      within(screen.getByRole("dialog")).getByText(/^It plans from today, Thursday 15 October\./),
    ).toBeTruthy();
  });

  it("should hold the dialog busy while the write is on its way, and never bring it back to life before it closes", async () => {
    const release = holdWrites();
    renderWithRoutineWrites(<RoutinesScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /^Make active, Upper Lower/ }));
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Make active" });
    const cancel = within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" });

    await userEvent.click(confirm);
    await waitFor(() => {
      expect(writesBackend.writes).toHaveLength(1);
    });

    // While it is on its way the confirm is inert, Cancel is off and Escape does not close it.
    expect(confirm.hasAttribute("disabled")).toBe(true);
    expect(cancel.hasAttribute("disabled")).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();

    // From here on, no frame may show an enabled confirm.
    const seenAlive: string[] = [];
    const watcher = new MutationObserver(() => {
      const open = screen.queryByRole("dialog");
      const button =
        open === null ? null : within(open).queryByRole("button", { name: "Make active" });
      if (button !== null && !button.hasAttribute("disabled")) {
        seenAlive.push("enabled confirm");
      }
    });
    watcher.observe(document.body, { subtree: true, childList: true, attributes: true });
    release();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    watcher.disconnect();

    expect(seenAlive).toEqual([]);
    expect(writesBackend.writes).toEqual([`activate:${UPPER_LOWER_ID}`]);
  });

  it("should return focus to the button that opened the question on Escape, even when a click did not focus it", async () => {
    renderWithRoutineWrites(<RoutinesScreen />);
    const opener = await screen.findByRole("button", { name: /^Make active, Upper Lower/ });

    // Safari does not focus a button when it is clicked, so the click here does not focus it either.
    fireEvent.click(opener);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(opener);
  });

  it("should keep the active routine and say once that it did not go through when the write fails", async () => {
    writesBackend.failingWrites = true;
    renderWithRoutineWrites(<RoutinesScreen />);

    await userEvent.click(await screen.findByRole("button", { name: /^Make active, Upper Lower/ }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Make active" }),
    );

    expect(await screen.findByText(ROUTINE_MAKE_ACTIVE_FAILED)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(flagsOf(PUSH_PULL_LEGS_ID).isActive).toBe(true);
    expect(screen.queryByText(/raw database text/)).toBeNull();
  });

  it("should turn Make active off offline, and say why through the buttons' description", async () => {
    renderWithRoutineWrites(<RoutinesScreen />);
    const button = await screen.findByRole("button", { name: /^Make active, Upper Lower/ });
    expect(button.hasAttribute("disabled")).toBe(false);

    goOffline();

    await waitFor(() => {
      expect(button.hasAttribute("disabled")).toBe(true);
    });
    expect(descriptionOf(button)).toBe(ROUTINES_OFFLINE.makeActive);
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(writesBackend.writes).toEqual([]);
  });

  it("should turn the confirm off, with the reason, when the connection drops while the question is open", async () => {
    renderWithRoutineWrites(<RoutinesScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /^Make active, Upper Lower/ }));

    goOffline();

    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Make active" });
    await waitFor(() => {
      expect(confirm.hasAttribute("disabled")).toBe(true);
    });
    expect(within(screen.getByRole("dialog")).getByText(ROUTINES_OFFLINE.makeActive)).toBeTruthy();
  });
});

describe("restoring an archived routine", () => {
  it("should restore on the press and drop the routine from the archived list", async () => {
    renderWithRoutineWrites(<ArchivedRoutinesScreen />);

    await userEvent.click(
      await screen.findByRole("button", { name: describeRestoreName("Starting strength") }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Starting strength")).toBeNull();
    });
    expect(writesBackend.writes).toEqual([`restore:${STARTING_STRENGTH_ID}`]);
  });

  it("should send one write however many presses arrive while it is on its way", async () => {
    const release = holdWrites();
    renderWithRoutineWrites(<ArchivedRoutinesScreen />);
    const restore = await screen.findByRole("button", {
      name: describeRestoreName("Starting strength"),
    });

    fireEvent.click(restore);
    fireEvent.click(restore);
    await waitFor(() => {
      expect(writesBackend.writes).toHaveLength(1);
    });
    release();

    await waitFor(() => {
      expect(screen.queryByText("Starting strength")).toBeNull();
    });
    expect(writesBackend.writes).toHaveLength(1);
  });

  it("should move focus to the next Restore once a routine is restored, and to Back when none is left", async () => {
    writesBackend.routines.push(storedRoutine(idOfOldSplit, "Old split", { isArchived: true }));
    renderWithRoutineWrites(<ArchivedRoutinesScreen />);

    await userEvent.click(
      await screen.findByRole("button", { name: describeRestoreName("Old split") }),
    );

    const remaining = await screen.findByRole("button", {
      name: describeRestoreName("Starting strength"),
    });
    await waitFor(() => {
      expect(screen.queryByText("Old split")).toBeNull();
      expect(document.activeElement).toBe(remaining);
    });

    await userEvent.click(remaining);

    await waitFor(() => {
      expect(screen.queryByText("Starting strength")).toBeNull();
      expect(document.activeElement).toBe(
        screen.getByRole("link", { name: ROUTINES_ARCHIVED.backLabel }),
      );
    });
  });

  it("should leave focus where it is when the restore fails", async () => {
    writesBackend.failingWrites = true;
    renderWithRoutineWrites(<ArchivedRoutinesScreen />);
    const restore = await screen.findByRole("button", {
      name: describeRestoreName("Starting strength"),
    });

    await userEvent.click(restore);

    await screen.findByText(ROUTINE_RESTORE_FAILED);
    expect(document.activeElement).toBe(restore);
  });

  it("should turn Restore off offline, say why, and send nothing", async () => {
    renderWithRoutineWrites(<ArchivedRoutinesScreen />);
    const restore = await screen.findByRole("button", {
      name: describeRestoreName("Starting strength"),
    });

    goOffline();

    await waitFor(() => {
      expect(restore.hasAttribute("disabled")).toBe(true);
    });
    expect(descriptionOf(restore)).toBe(ROUTINES_OFFLINE.restore);
    fireEvent.click(restore);
    expect(writesBackend.writes).toEqual([]);
  });

  it("should say it was not restored, and keep the routine archived, when the write fails", async () => {
    writesBackend.failingWrites = true;
    renderWithRoutineWrites(<ArchivedRoutinesScreen />);

    await userEvent.click(
      await screen.findByRole("button", { name: describeRestoreName("Starting strength") }),
    );

    expect(await screen.findByText(ROUTINE_RESTORE_FAILED)).toBeTruthy();
    expect(screen.getByText("Starting strength")).toBeTruthy();
  });
});

describe("archiving from the editor", () => {
  /** The editor and the list as the router moves between them, so the editor really goes. */
  function Flow({ id }: { id: string }) {
    const [path, setPath] = useState(`/train/routines/${id}`);
    router.replace.mockImplementation((next: string) => {
      setPath(next);
    });
    return path === "/train/routines" ? <RoutinesScreen /> : <RoutineEditorScreen id={id} />;
  }

  const archive = () => screen.getByRole("button", { name: ROUTINE_EDITOR.archiveAction });
  const openEditor = async (id = UPPER_LOWER_ID) => {
    const view = renderWithRoutineWrites(<Flow id={id} />);
    await screen.findByRole("textbox", { name: ROUTINE_EDITOR.nameLabel });
    return view;
  };

  it("should leave the editor at once for the list, and show the routine under Archived once", async () => {
    await openEditor();

    await userEvent.click(archive());

    await screen.findByRole("heading", { name: ROUTINES_SCREEN.title, level: 1 });
    expect(router.replace).toHaveBeenCalledWith("/train/routines");
    expect(writesBackend.writes).toEqual([`archive:${UPPER_LOWER_ID}`]);
    expect(await screen.findByRole("link", { name: describeArchivedRoutinesLink(2) })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: describeMakeActiveName("Upper Lower") }),
    ).toBeNull();
    expect(screen.getByText(ROUTINE_ARCHIVED_TOAST.message)).toBeTruthy();
  });

  it("should put the routine back under Other routines when Undo is pressed after the editor has gone", async () => {
    await openEditor();
    await userEvent.click(archive());
    await screen.findByRole("heading", { name: ROUTINES_SCREEN.title, level: 1 });
    expect(screen.queryByRole("textbox", { name: ROUTINE_EDITOR.nameLabel })).toBeNull();

    await userEvent.click(
      await screen.findByRole("button", { name: ROUTINE_ARCHIVED_TOAST.undoAction }),
    );

    expect(
      await screen.findByRole("button", { name: describeMakeActiveName("Upper Lower") }),
    ).toBeTruthy();
    expect(writesBackend.writes).toEqual([
      `archive:${UPPER_LOWER_ID}`,
      `restore:${UPPER_LOWER_ID}`,
    ]);
    expect(flagsOf(UPPER_LOWER_ID).isArchived).toBe(false);
  });

  it("should go back to the Archived link when the Undo toast closes with focus on it, after a keyboard press", async () => {
    await openEditor();
    archive().focus();

    await userEvent.keyboard("{Enter}");

    const undo = await screen.findByRole("button", { name: ROUTINE_ARCHIVED_TOAST.undoAction });
    await waitFor(() => {
      expect(document.activeElement).toBe(undo);
    });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: ROUTINE_ARCHIVED_TOAST.undoAction })).toBeNull();
    });
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: describeArchivedRoutinesLink(2) }),
    );
  });

  it("should draw Archive routine off for the active routine, with its reason described", async () => {
    await openEditor(PUSH_PULL_LEGS_ID);

    expect(archive().hasAttribute("disabled")).toBe(true);
    expect(descriptionOf(archive())).toBe(ARCHIVE_ACTIVE_REFUSAL);
    expect(screen.getByText(ARCHIVE_ACTIVE_REFUSAL)).toBeTruthy();
    fireEvent.click(archive());
    expect(writesBackend.writes).toEqual([]);
  });

  it("should turn Archive routine off while the draft has changes, with its reason described", async () => {
    await openEditor();
    expect(archive().hasAttribute("disabled")).toBe(false);

    await userEvent.type(screen.getByRole("textbox", { name: ROUTINE_EDITOR.nameLabel }), " B");

    expect(archive().hasAttribute("disabled")).toBe(true);
    expect(descriptionOf(archive())).toBe(ROUTINE_ARCHIVE_UNSAVED);
    fireEvent.click(archive());
    expect(writesBackend.writes).toEqual([]);
  });

  it("should turn Archive routine off offline and say why", async () => {
    await openEditor();

    goOffline();

    await waitFor(() => {
      expect(archive().hasAttribute("disabled")).toBe(true);
    });
    expect(descriptionOf(archive())).toBe(ROUTINES_OFFLINE.archive);
    fireEvent.click(archive());
    expect(writesBackend.writes).toEqual([]);
  });

  it("should hold Archive routine busy while the write is on its way, and send one write", async () => {
    const release = holdWrites();
    await openEditor();
    const button = archive();

    await userEvent.click(button);
    await waitFor(() => {
      expect(writesBackend.writes).toHaveLength(1);
    });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(button);
    expect(
      screen.getByRole("button", { name: ROUTINE_EDITOR.saveAction }).hasAttribute("disabled"),
    ).toBe(true);
    release();

    await screen.findByRole("heading", { name: ROUTINES_SCREEN.title, level: 1 });
    expect(writesBackend.writes).toEqual([`archive:${UPPER_LOWER_ID}`]);
  });

  it("should stay in the editor and say it was not archived when the write fails", async () => {
    writesBackend.failingWrites = true;
    await openEditor();

    await userEvent.click(archive());

    expect(await screen.findByText(ROUTINE_ARCHIVE_FAILED)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect(archive().hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText(/raw database text/)).toBeNull();
  });

  it("should not draw Archive routine for an archived routine", async () => {
    await openEditor(STARTING_STRENGTH_ID);

    expect(screen.queryByRole("button", { name: ROUTINE_EDITOR.archiveAction })).toBeNull();
    expect(screen.queryByText(ARCHIVE_ACTIVE_REFUSAL)).toBeNull();
  });

  it("should not draw Archive routine for a routine that is not stored yet", () => {
    renderWithRoutineWrites(<RoutineEditor />);

    expect(screen.getByRole("textbox", { name: ROUTINE_EDITOR.nameLabel })).toBeTruthy();
    expect(screen.queryByRole("button", { name: ROUTINE_EDITOR.archiveAction })).toBeNull();
  });
});
