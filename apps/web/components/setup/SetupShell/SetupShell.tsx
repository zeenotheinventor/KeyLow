"use client";

import { SETUP_SHELL } from "@keylow/core/copy";
import { useEffect, useId, useRef } from "react";

import type { SetupShellProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { vars } from "@/lib/vars";

/**
 * What every step of the setup wizard sits in, in the shape of `QuestionStepper`: a card 560 px wide at most,
 * the caption above a 4 px progress bar, the question and its helper, the answers, a notice, then a footer at
 * the right that does not stick. Close and Back are the caller's to give, because only it knows where the
 * step is and how the wizard was opened. Focus moves to the question when the step changes, so a keyboard or
 * screen reader user starts at it.
 */
export function SetupShell({
  stepKey,
  caption,
  progressName,
  progressFraction,
  question,
  helper,
  onBack,
  onClose,
  continueAction,
  notice,
  children,
}: SetupShellProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, [stepKey]);

  return (
    <Card asChild padding="none">
      <section
        aria-labelledby={titleId}
        className="mx-auto flex w-full max-w-[560px] flex-col gap-3 p-4 min-[700px]:p-8"
      >
        <span className="text-caption tabular-nums text-text-secondary">{caption}</span>
        <div
          role="progressbar"
          aria-label={progressName}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressFraction * 100)}
          className="h-1 overflow-hidden rounded-[2px] bg-surface-raised"
        >
          <span
            // The fraction is core's and moves with the goal, so it reaches the class as a custom property.
            style={vars({ "--progress": `${progressFraction * 100}%` })}
            className="block h-1 w-[var(--progress)] bg-accent"
          />
        </div>
        <h1 ref={titleRef} id={titleId} tabIndex={-1} className="mt-2 text-h1 outline-none">
          {question}
        </h1>
        <p className="text-body text-text-secondary">{helper}</p>
        {children}
        {notice}
        <div className="mt-2 flex justify-end gap-2">
          {onClose === undefined ? null : (
            <Button variant="ghost" onClick={onClose}>
              {SETUP_SHELL.closeName}
            </Button>
          )}
          {onBack === undefined ? null : (
            <Button variant="secondary" onClick={onBack}>
              {SETUP_SHELL.backName}
            </Button>
          )}
          <Button disabled={!continueAction.isEnabled} onClick={continueAction.onPress}>
            {SETUP_SHELL.continueLabel}
          </Button>
        </div>
      </section>
    </Card>
  );
}
