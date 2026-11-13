"use client";

import { useEffect } from "react";

import type { RefObject } from "react";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

/** The controls inside a panel that Tab can reach, in document order. */
export function focusableElementsIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
}

// Modal layers can overlap. The page stays locked until the last one closes, and only the topmost one
// answers Escape and Tab.
const openPanels: HTMLElement[] = [];
let scrollLockCount = 0;
let overflowBeforeScrollLock = "";

function lockPageScroll() {
  if (scrollLockCount === 0) overflowBeforeScrollLock = document.body.style.overflow;
  scrollLockCount += 1;
  document.body.style.overflow = "hidden";
}

function unlockPageScroll() {
  scrollLockCount -= 1;
  if (scrollLockCount === 0) document.body.style.overflow = overflowBeforeScrollLock;
}

type ModalLayerOptions = {
  /** The panel that holds focus while the layer is active. */
  panelRef: RefObject<HTMLElement | null>;
  /** Whether the layer is modal now. A panel that is modal only at some widths passes that in. */
  isActive: boolean;
  /** Called on Escape while this is the topmost layer. Leave it out when the panel handles Escape itself. */
  onEscape?: (() => void) | undefined;
};

/**
 * What makes a panel modal: the page behind stops scrolling, Tab stays inside the panel (a Tab from outside it
 * moves in), and Escape calls `onEscape`, for the topmost layer only. Moving focus in and giving it back are the
 * owner's, because each panel has its own idea of where focus goes.
 */
export function useModalLayer({ panelRef, isActive, onEscape }: ModalLayerOptions) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!isActive || panel === null) return;

    lockPageScroll();
    openPanels.push(panel);

    return () => {
      unlockPageScroll();
      openPanels.splice(openPanels.indexOf(panel), 1);
    };
  }, [isActive, panelRef]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!isActive || panel === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openPanels[openPanels.length - 1] !== panel) return;
      if (event.key === "Escape") {
        onEscape?.();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableElementsIn(panel);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        panel.focus();
      } else if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, onEscape, panelRef]);
}
