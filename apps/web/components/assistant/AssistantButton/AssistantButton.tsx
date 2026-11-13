"use client";

import { ASSISTANT_SHEET } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";

import type { AssistantButtonProps } from "./types";

import { useAssistant } from "@/components/assistant/AssistantProvider";
import { Button } from "@/components/ui/Button";
import { trainPath } from "@/lib/trainRoutes";
import { cn } from "@/lib/utils";

const isUnder = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * The top bar's Assistant button, on every signed in page: the label from the large breakpoint, and the
 * icon alone below it, where it sits beside Menu and keeps the name "Assistant". It opens the panel, or
 * closes it when it is open. On the Train pages the panel opens with the training words.
 */
export function AssistantButton({ className }: AssistantButtonProps) {
  const { isOpen, open, close, buttonRef } = useAssistant();
  const pathname = usePathname();

  return (
    <Button
      ref={buttonRef}
      variant="secondary"
      size="sm"
      aria-expanded={isOpen}
      className={cn("max-lg:w-control-sm max-lg:min-w-0 max-lg:px-0", className)}
      onClick={() => {
        if (isOpen) {
          close();
        } else {
          open(isUnder(pathname, trainPath()) ? "train" : undefined);
        }
      }}
    >
      <Sparkles aria-hidden strokeWidth={iconStroke} />
      <span className="max-lg:sr-only">{ASSISTANT_SHEET.title}</span>
    </Button>
  );
}
