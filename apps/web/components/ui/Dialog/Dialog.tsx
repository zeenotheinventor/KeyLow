"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "../Button";

import type { DialogProps } from "./types";
import type * as React from "react";

import { cn } from "@/lib/utils";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

function focusableElementsIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
}

// Dialogs can overlap. The page stays locked until the last one closes, and only the topmost one
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

function isShown(node: React.ReactNode): boolean {
  return node !== null && node !== undefined && node !== false;
}

// At 700 px and up the dialog is a centred 560 px panel with a border and a large radius. Below
// that it fills the screen, and its header and footer clear the device's safe areas. Each class is
// written out whole so Tailwind can see it.
const panelClasses =
  "relative flex w-full max-w-full flex-col bg-surface-sheet text-text-primary shadow-sheet outline-none animate-dialog-in motion-reduce:animate-none min-[700px]:max-h-[calc(100%-theme(spacing.12))] min-[700px]:w-[560px] min-[700px]:rounded-large min-[700px]:border min-[700px]:border-border";

const headerClasses =
  "flex items-center justify-between gap-3 border-b border-border py-3 pl-5 pr-3 pt-[calc(theme(spacing.3)+env(safe-area-inset-top,0px))] min-[700px]:pt-3";

const footerClasses =
  "flex items-center justify-end gap-3 border-t border-border px-5 pt-3 pb-[calc(theme(spacing.3)+env(safe-area-inset-bottom,0px))] min-[700px]:pb-3";

/**
 * A modal on the sheet surface. Focus moves in when it opens, stays inside while it is open and
 * returns to the opener when it closes. Escape and a press on the dimmed page call `onClose`, and
 * the page behind stops scrolling.
 *
 * The panel is `fixed` and is not portalled, so an ancestor with a transform, filter or `contain`
 * would become its containing block and break its layout. Render it outside such an ancestor.
 *
 * It is built by hand and not on the native dialog element, because jsdom does not model that
 * element's modality, so the focus and Escape behaviour could not be tested.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  leadingAction,
  className,
  returnFocusTo,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [opener, setOpener] = useState<Element | null>(null);
  const titleId = useId();

  // An autofocused child takes focus while React commits, before any effect of this component
  // runs, so the element that opened the dialog is read here, while it still has focus.
  if (!open && opener !== null) {
    setOpener(null);
  } else if (open && opener === null && typeof document !== "undefined") {
    setOpener(document.activeElement);
  }

  // Where focus goes on close: the element that was focused when it opened, unless the owner says another.
  const focusTarget = returnFocusTo === undefined ? opener : returnFocusTo;

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || panel === null) return;

    lockPageScroll();
    openPanels.push(panel);
    if (!panel.contains(document.activeElement)) (focusableElementsIn(panel)[0] ?? panel).focus();

    return () => {
      unlockPageScroll();
      openPanels.splice(openPanels.indexOf(panel), 1);
      if (focusTarget instanceof HTMLElement) focusTarget.focus();
    };
  }, [open, focusTarget]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || panel === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openPanels[openPanels.length - 1] !== panel) return;
      if (event.key === "Escape") {
        onClose();
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        // Only a press on the dimmed page itself closes it, not one that began inside the panel.
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-40 flex items-stretch justify-center font-sans min-[700px]:items-center"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-overlay animate-dim-in motion-reduce:animate-none"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(panelClasses, className)}
      >
        <header className={headerClasses}>
          <h2 id={titleId} className="min-w-0 truncate text-h2">
            {title}
          </h2>
          <Button variant="ghost" iconOnly aria-label="Close" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
        {(isShown(footer) || isShown(leadingAction)) && (
          <footer className={footerClasses}>
            {isShown(leadingAction) && <div className="mr-auto">{leadingAction}</div>}
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
