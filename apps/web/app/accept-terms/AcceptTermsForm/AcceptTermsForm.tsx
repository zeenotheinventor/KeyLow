"use client";

import { acceptTerms } from "@keylow/api-client";
import { ACCEPT_TERMS_SCREEN, GENERIC_ERROR, TERMS_VERSION } from "@keylow/core/copy";
import { useRouter } from "next/navigation";
import { useState, useTransition, type SubmitEvent } from "react";

import { AcceptanceCheckbox } from "@/components/auth/AcceptanceCheckbox";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function AcceptTermsForm() {
  const router = useRouter();
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isNavigating, startNavigation] = useTransition();

  async function accept() {
    setFormError(null);
    setIsSaving(true);
    try {
      await acceptTerms(createClient(), TERMS_VERSION);
    } catch {
      setFormError(GENERIC_ERROR);
      setIsSaving(false);
      return;
    }

    // The spinner stays on while the dashboard loads, and goes off if this page is still showing
    // when that ends, such as when the dashboard layout sends the user straight back.
    setIsSaving(false);
    startNavigation(() => {
      router.push("/dashboard");
      router.refresh();
    });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasAccepted) {
      void accept();
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
      <AcceptanceCheckbox checked={hasAccepted} onCheckedChange={setHasAccepted} />

      {formError !== null && <Banner tone="error">{formError}</Banner>}

      <Button
        type="submit"
        loading={isSaving || isNavigating}
        loadingLabel="Saving"
        disabled={!hasAccepted}
      >
        {ACCEPT_TERMS_SCREEN.continueLabel}
      </Button>
    </form>
  );
}
