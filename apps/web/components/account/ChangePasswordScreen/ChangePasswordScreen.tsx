"use client";

import { useUpdatePassword } from "@keylow/api-client";
import { describePasswordUpdateFailure } from "@keylow/core/accounts";
import {
  CHANGE_PASSWORD_SCREEN,
  PASSWORD_CHANGED,
  TAB_TITLES,
  describePasswordFor,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ChangePasswordScreenProps } from "./types";

import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Card } from "@/components/ui/Card";

const MORE_HREF = "/more";

/**
 * "Change password", the page the Change password row of More opens. A signed in person asks for the new
 * password twice and no current one. A save signs the other devices out. Once saved the fields stay,
 * disabled, under a success notice, and Done goes back to More.
 */
export function ChangePasswordScreen({ email }: ChangePasswordScreenProps) {
  const router = useRouter();
  const { mutateAsync } = useUpdatePassword();
  const [isSaved, setIsSaved] = useState(false);

  async function save(newPassword: string) {
    // A mutation waits for a connection and never settles while the browser is offline, so the person
    // would see the spinner for good. The failure for no connection is the one the server would give.
    if (!onlineManager.isOnline()) {
      return describePasswordUpdateFailure("network", "change");
    }

    return mutateAsync({ newPassword, context: "change" });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <BackToFoodsLink label={TAB_TITLES.more} href={MORE_HREF} />
      <h1 className="text-h1">{CHANGE_PASSWORD_SCREEN.heading}</h1>
      <Card padding="none" className="flex flex-col gap-4 p-6 sm:p-8">
        <p className="text-body text-text-secondary">{describePasswordFor(email)}</p>
        <NewPasswordForm
          copy={CHANGE_PASSWORD_SCREEN}
          onSave={save}
          onSaved={() => {
            setIsSaved(true);
          }}
          buttonPlacement="end"
          completed={
            isSaved
              ? {
                  title: PASSWORD_CHANGED.title,
                  body: PASSWORD_CHANGED.body,
                  doneLabel: PASSWORD_CHANGED.doneLabel,
                  onDone: () => {
                    router.push(MORE_HREF);
                  },
                }
              : undefined
          }
        />
      </Card>
    </div>
  );
}
