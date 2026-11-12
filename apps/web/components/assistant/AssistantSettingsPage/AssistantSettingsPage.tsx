"use client";

import {
  useAssistantConsent,
  useDeleteAllAssistantConversations,
  useSetAssistantConsent,
} from "@keylow/api-client";
import {
  ASSISTANT_CONSENT_CARD,
  ASSISTANT_DELETE_ALL_DIALOG,
  ASSISTANT_SETTINGS,
  DELETE_FAILED_BANNER,
  LEGAL_PATHS,
  SAVE_FAILED_BANNER,
  describeAssistantConsentCaption,
} from "@keylow/core/copy";
import { ChevronLeft, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { GroupedList } from "@/components/ui/GroupedList";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/Toast";
import { useIsOnline } from "@/lib/useIsOnline";

const MORE_HREF = "/more";

const saveFailedToast = {
  message: SAVE_FAILED_BANNER,
  tone: "danger",
  icon: CircleAlert,
} as const;

// NOT ON THE CANVAS: no board draws the failure of a delete, so these words await Zee.
const deleteFailedToast = {
  message: DELETE_FAILED_BANNER,
  tone: "danger",
  icon: CircleAlert,
} as const;

/**
 * The Assistant settings page, opened from More (`web-assistant-settings · consent`): the switch that turns the
 * assistant on, with its caption, what it does in the consent card's own words with the Privacy policy link,
 * and Your conversations, on or off: Delete all conversations behind a confirmation. It is the twin of the
 * phone's screen, with one gap: What the assistant changed is not here until the page it opens is built.
 *
 * The page is drawn at once. The switch is dimmed, and the caption left out, until the setting has been read,
 * so a read that waits for a connection never leaves a skeleton. The switch is dimmed too while a change is
 * being saved and while offline, where a write would wait and then land with nobody watching. It follows what
 * was stored, never the press: a refused write changes nothing and says so in a toast at the top.
 */
export function AssistantSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const isOnline = useIsOnline();
  const consent = useAssistantConsent();
  const setConsent = useSetAssistantConsent();
  const deleteAll = useDeleteAllAssistantConversations();
  const [isAskingToDelete, setIsAskingToDelete] = useState(false);
  const whatItDoesId = useId();
  const isRead = consent.data !== undefined;
  const isOn = consent.data?.isOn ?? false;

  function deleteEverything() {
    // The question closes either way, so a failure's toast is not under it, and the row asks again.
    deleteAll.mutate(undefined, {
      onSuccess: () => {
        setIsAskingToDelete(false);
      },
      onError: () => {
        setIsAskingToDelete(false);
        toast.show(deleteFailedToast);
      },
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <header className="flex items-center gap-2">
        <IconButton
          icon={ChevronLeft}
          label={ASSISTANT_SETTINGS.back}
          size="card"
          onClick={() => {
            router.push(MORE_HREF);
          }}
        />
        <h1 className="min-w-0 flex-1 truncate text-center text-h2 md:text-left md:text-h1">
          {ASSISTANT_SETTINGS.title}
        </h1>
        {/* Below the medium width the title is centred between the button and a space as wide as it. */}
        <span aria-hidden className="size-10 shrink-0 md:hidden" />
      </header>
      <div className="flex flex-col gap-2">
        <Card asChild padding="none">
          <ul>
            <ListRow
              title={ASSISTANT_SETTINGS.useLabel}
              toggle={{
                isOn,
                label: ASSISTANT_SETTINGS.useLabel,
                disabled: !isRead || setConsent.isPending || !isOnline,
                onValueChange: (next) => {
                  // A refused write changes nothing, so the switch stays as it was and the toast says so.
                  setConsent.mutate(
                    { on: next },
                    {
                      onError: () => {
                        toast.show(saveFailedToast);
                      },
                    },
                  );
                },
              }}
            />
          </ul>
        </Card>
        {isRead && (
          <p className="px-1 text-caption text-text-muted">
            {describeAssistantConsentCaption(isOn)}
          </p>
        )}
      </div>
      <section aria-labelledby={whatItDoesId} className="flex flex-col gap-2">
        <h2 id={whatItDoesId} className="px-1 text-body-strong">
          {ASSISTANT_SETTINGS.whatItDoes}
        </h2>
        <Card className="flex flex-col gap-3">
          {ASSISTANT_CONSENT_CARD.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-body text-text-secondary">
              {paragraph}
            </p>
          ))}
          <Link
            href={LEGAL_PATHS.privacy}
            className="-my-3 flex min-h-touch-target items-center self-start rounded-small text-body-strong text-accent-ink underline outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {ASSISTANT_CONSENT_CARD.privacyLinkLabel}
          </Link>
        </Card>
      </section>
      {/* The board draws this group only when the assistant is on. It is drawn off as well, as the phone does: the
          consent card promises conversations are kept until the person deletes them, so someone who turns the
          assistant off must still be able to. */}
      <div className="flex flex-col gap-2">
        <GroupedList title={ASSISTANT_SETTINGS.yourConversations} headerSize="compact">
          <ListRow
            title={ASSISTANT_SETTINGS.deleteAllLabel}
            titleTone="danger"
            chevron={false}
            onClick={() => {
              setIsAskingToDelete(true);
            }}
          />
        </GroupedList>
        <p className="px-1 text-caption text-text-muted">{ASSISTANT_SETTINGS.deleteAllCaption}</p>
      </div>
      <Dialog
        open={isAskingToDelete}
        title={ASSISTANT_DELETE_ALL_DIALOG.title}
        closeDisabled={deleteAll.isPending}
        onClose={() => {
          setIsAskingToDelete(false);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={deleteAll.isPending}
              onClick={() => {
                setIsAskingToDelete(false);
              }}
            >
              {ASSISTANT_DELETE_ALL_DIALOG.cancelLabel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={deleteAll.isPending}
              disabled={!isOnline}
              onClick={deleteEverything}
            >
              {ASSISTANT_DELETE_ALL_DIALOG.confirmLabel}
            </Button>
          </>
        }
      >
        <p className="text-body text-text-secondary">{ASSISTANT_DELETE_ALL_DIALOG.body}</p>
      </Dialog>
    </div>
  );
}
