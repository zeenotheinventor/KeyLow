"use client";

import { isDailyLimitFailure, useCreateFeatureRequest } from "@keylow/api-client";
import { FEATURE_REQUEST_SCREEN, describeFeatureRequestLength } from "@keylow/core/copy";
import { featureRequestTextSchema, isFeatureRequestTooLong } from "@keylow/core/featureRequests";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/TextArea";
import { useToast } from "@/components/ui/Toast";

const MORE_HREF = "/more";

/**
 * "Request a feature", the page the Request a feature row of More opens. No board draws it, so it follows Export
 * my data, as the phone's screen does: a Back link and title, one line on where the request goes, a text area
 * with its count, and Send. Send is off until the trimmed text is long enough to save, and while a send is on its
 * way. A send that works says thanks in a toast at the top and goes back to More. One that fails keeps the text
 * and shows a banner, with the daily limit worded on its own. Offline nothing is drawn differently, as on the
 * phone: the write waits and goes when the connection returns, with Send showing it is sending. The text is only
 * ever sent to the database: it is never logged or reported.
 */
export function FeatureRequestScreen() {
  const router = useRouter();
  const toast = useToast();
  // The thanks is said from the hook, so it still shows when Back was pressed while the request was on its way.
  const sendRequest = useCreateFeatureRequest({
    onSaved: () => {
      toast.show({ message: FEATURE_REQUEST_SCREEN.sentToast, tone: "success", icon: Check });
    },
  });
  const [text, setText] = useState("");
  const copy = FEATURE_REQUEST_SCREEN;
  const isTooLong = isFeatureRequestTooLong(text);
  const canSend = featureRequestTextSchema.safeParse(text).success;

  function send() {
    if (!canSend || sendRequest.isPending) {
      return;
    }
    sendRequest.mutate(
      { source: "more_menu", request: text },
      {
        onSuccess: () => {
          setText("");
          router.push(MORE_HREF);
        },
      },
    );
  }

  function renderProblem() {
    if (!sendRequest.isError) {
      return null;
    }
    const problem = isDailyLimitFailure(sendRequest.error) ? copy.dailyLimit : copy.failed;
    return (
      <Banner tone="error" title={problem.title}>
        {problem.body}
      </Banner>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BackToFoodsLink tone="accent" label={copy.back} href={MORE_HREF} />
        <h1 className="text-h1">{copy.title}</h1>
      </div>
      <Card>
        <p className="text-body text-text-secondary">{copy.explainer}</p>
      </Card>
      <TextArea
        counter={describeFeatureRequestLength(text)}
        error={isTooLong ? copy.tooLong : undefined}
        isOverLimit={isTooLong}
        label={copy.fieldLabel}
        placeholder={copy.placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      {renderProblem()}
      <div className="flex flex-col md:flex-row-reverse">
        <Button
          className="max-md:w-full"
          disabled={!canSend}
          loading={sendRequest.isPending}
          onClick={send}
        >
          {copy.send}
        </Button>
      </div>
    </div>
  );
}
