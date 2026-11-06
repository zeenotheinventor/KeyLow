"use client";

import { exportMyData, useAccountExportFile, useSupabase } from "@keylow/api-client";
import {
  ACCOUNT_EXPORT_COPY,
  ACCOUNT_EXPORT_WEB_COPY,
  describeExportDownloaded,
  describeExportReady,
  OFFLINE_BANNER,
} from "@keylow/core/copy";
import { FileJson, LoaderCircle, ShieldAlert, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { saveFileToDownloads } from "./saveFileToDownloads";

import type { ComponentProps, ReactNode } from "react";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { useIsOnline } from "@/lib/useIsOnline";
import { cn } from "@/lib/utils";

const MORE_HREF = "/more";

// The progress row's icon turns, and pulses instead for a person who asks for less motion.
function ProgressIcon({ className, ...props }: ComponentProps<typeof LoaderCircle>) {
  return (
    <LoaderCircle
      {...props}
      className={cn(className, "animate-spin motion-reduce:animate-pulse")}
    />
  );
}

// The buttons, then the caption. From the medium width the main button is at the far right and the caption fills
// the left, as the goal summary puts its actions. Below it they are a column of full-width buttons with the
// caption centred under them.
function Footer({ caption, children }: { caption?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row-reverse md:items-center md:gap-4">
      <div className="flex flex-col gap-2 md:flex-row-reverse">{children}</div>
      {caption !== undefined && (
        <p className="text-center text-caption text-text-muted md:min-w-0 md:flex-1 md:text-left">
          {caption}
        </p>
      )}
    </div>
  );
}

/**
 * "Export my data", the page the Export my data row of More opens, as the `web-export` boards draw it. It
 * prepares the whole-account file as it opens, with no Start button, and `useAccountExportFile` holds the file in
 * a ref, so it is never in state, a cache or a log. What the file holds and the health data warning stay in every
 * state. Under them is the progress row, the file row once it is ready or downloaded, or the danger banner when
 * the export failed. Save file downloads the file through the browser, so there is no saving state: it sends
 * `save` and then `savedTo` with no folder in the same press, and the file is dropped, which is why Downloaded
 * has Done alone. Done and Back go to More, and coming back prepares a new file.
 *
 * The offline board is not a reducer state. It is worked out when the page renders, from the connection and the
 * hook: it shows while the browser is offline and the file is not ready, and for a failure that happened
 * offline. A failure that happened offline is prepared again once, silently, when the connection returns. A
 * failure that happened online stays on the failed board, and only a press of Try again prepares again, so a
 * silent attempt that fails does not start a loop. A file that is ready stays ready offline.
 */
export function ExportMyDataScreen() {
  const router = useRouter();
  const client = useSupabase();
  const isOnline = useIsOnline();
  const readExport = useCallback(() => exportMyData(client), [client]);
  const { state, fileName, sizeText, readFile, dispatch, failedOffline } = useAccountExportFile({
    isActive: true,
    readExport,
  });
  const copy = ACCOUNT_EXPORT_COPY;
  const webCopy = ACCOUNT_EXPORT_WEB_COPY;

  // The silent prepare: only for a failure that happened offline, when the connection is back. It sends the
  // existing retry, which clears that fact, so it runs once for each time the connection returns, and a silent
  // attempt that fails offline again waits for the next return.
  useEffect(() => {
    if (isOnline && state.status === "failed" && failedOffline) {
      dispatch({ type: "retry" });
    }
  }, [isOnline, state.status, failedOffline, dispatch]);

  function save() {
    const file = readFile();
    if (file === null) {
      return;
    }
    dispatch({ type: "save" });
    try {
      saveFileToDownloads(file);
    } catch {
      // The error is not read: it could carry the file, and the board states the rule instead.
      dispatch({ type: "failedWhile", step: "saving" });
      return;
    }
    dispatch({ type: "savedTo", folderName: "" });
  }

  function goToMore() {
    router.push(MORE_HREF);
  }

  const isWaiting = state.status === "idle" || state.status === "preparing";
  const showsOfflineBoard =
    (!isOnline && isWaiting) || (state.status === "failed" && failedOffline);

  function renderStatus() {
    if (showsOfflineBoard) {
      return (
        <Banner title={OFFLINE_BANNER.title} icon={WifiOff}>
          {webCopy.offline.body}
        </Banner>
      );
    }
    if (state.status === "failed") {
      return (
        <Banner tone="error" title={copy.failed.title}>
          {copy.failed.body}
        </Banner>
      );
    }
    // One region that stays mounted from preparing to downloaded, so a screen reader hears the progress row
    // become the Ready file row and then the Downloaded one.
    return (
      <div role="status" aria-live="polite">
        <Card asChild padding="none">
          <ul>
            {isWaiting ? (
              <ListRow
                icon={ProgressIcon}
                title={copy.preparing.title}
                subtitle={copy.preparing.caption}
              />
            ) : (
              <ListRow
                icon={FileJson}
                title={fileName ?? ""}
                subtitle={
                  state.status === "saved"
                    ? describeExportDownloaded(sizeText ?? "")
                    : describeExportReady(sizeText ?? "")
                }
                trailing={{
                  kind: "tick",
                  label: state.status === "saved" ? webCopy.saved.tickLabel : copy.ready.tickLabel,
                }}
              />
            )}
          </ul>
        </Card>
      </div>
    );
  }

  function renderFooter() {
    if (showsOfflineBoard || isWaiting) {
      return (
        <Footer caption={copy.preparing.footer}>
          <Button disabled className="max-md:w-full">
            {copy.preparing.save}
          </Button>
        </Footer>
      );
    }
    switch (state.status) {
      case "ready":
      case "saving":
        return (
          <Footer caption={webCopy.ready.footer}>
            <Button className="max-md:w-full" onClick={save}>
              {copy.ready.save}
            </Button>
            <Button variant="secondary" className="max-md:w-full" onClick={goToMore}>
              {copy.ready.done}
            </Button>
          </Footer>
        );
      case "saved":
        return (
          <Footer caption={webCopy.saved.footer}>
            <Button className="max-md:w-full" onClick={goToMore}>
              {copy.saved.done}
            </Button>
          </Footer>
        );
      case "failed":
        return (
          <Footer>
            <Button
              className="max-md:w-full"
              onClick={() => {
                dispatch({ type: "retry" });
              }}
            >
              {copy.failed.retry}
            </Button>
          </Footer>
        );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BackToFoodsLink tone="accent" label={copy.back} href={MORE_HREF} />
        <h1 className="text-h1">{copy.title}</h1>
      </div>
      <Card asChild>
        <section aria-label={copy.contents.title} className="flex flex-col gap-2">
          <h2 className="text-body-strong">{copy.contents.title}</h2>
          <p className="text-body text-text-secondary">{copy.contents.body}</p>
        </section>
      </Card>
      <Banner tone="review" icon={ShieldAlert}>
        {copy.healthData}
      </Banner>
      {renderStatus()}
      {renderFooter()}
    </div>
  );
}
