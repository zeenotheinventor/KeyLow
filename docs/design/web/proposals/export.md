# Web Export my data boards

Boards for the web export ([KEY-846](https://linear.app/sojisoft/issue/KEY-846), the web twin of the boards behind [KEY-708](https://linear.app/sojisoft/issue/KEY-708)). The design gate is met by these boards, under Zee's ruling of 2026-11-05 for MWEB. Zee reviews after the build. They are not on the canvas, so they sit in `proposals/`, where `tools/design-export` does not look. Each is a PNG at device pixel ratio 2 and a standalone page that opens from `file://`. The frames are 1280 dark, 1280 light, 375 dark and 375 light, from left to right. The pages link `packages/tokens` by relative path and use no raw hex.

Golden data: `ki-lo-export-2026-10-25.json` and 1.8 MB, the phone board's, through the real `accountExportFileName` and `formatFileSize`. Sam Taylor's email on the Sign out row, as on the other web boards.

## Boards

Search by the heading. Every word except the new strings below is the real output of `packages/core/src/copy/`.

| Heading                   | File                | What it shows                                                                                                                                                                                                                                   |
| ------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `web-more · export-row`   | `export-more-row`   | More as `apps/web/app/(dashboard)/more/page.tsx` draws it today, with Export my data first in Account, above Sign out.                                                                                                                          |
| `web-export · preparing`  | `export-preparing`  | The page as it opens. The progress row, Save file off, "You can save the file once it is ready."                                                                                                                                                |
| `web-export · ready`      | `export-ready`      | The file row with its tick (named "Ready"), "1.8 MB · Ready to save", Save file and Done, and the web footer.                                                                                                                                   |
| `web-export · downloaded` | `export-downloaded` | The file row with its tick (named "Downloaded"), "1.8 MB · Downloaded", Done as the main button, and the web line.                                                                                                                              |
| `web-export · failed`     | `export-failed`     | The danger banner in the place of the row, and Try again. Back to More is the only other way out, as on the phone.                                                                                                                              |
| `web-export · offline`    | `export-offline`    | "You're offline" in the place of the row, Save file off, and the launcher in the top bar dimmed, as `DashboardNav` dims it on every page. No phone board or state to follow: see the decisions.                                                 |

What the file holds and the health data warning stay in every state of the page, as on the phone. The page's address is `/more/export`, and More stays the current section with no change to `DashboardNav`, because the address is under `/more`.

## Kit components

| Component                                 | Verdict | Where and how                                                                                                                                                                                                 |
| ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageFrame variant="shell"`               | Reuse   | With the `max-w-2xl` column, `flex-col gap-4`, of More and About.                                                                                                                                             |
| `BackToFoodsLink tone="accent"`           | Reuse   | `label={ACCOUNT_EXPORT_COPY.back}`, `href="/more"`, above the title in a `gap-1` stack, as on the recipe library. The component's name is older than its use.                                                 |
| `Card`, default padding                   | Reuse   | What the file holds.                                                                                                                                                                                          |
| `Banner tone="review" icon={ShieldAlert}` | Reuse   | The health data sentence, with no title, so it takes the body size in the primary ink.                                                                                                                        |
| `Banner tone="error"`                     | Reuse   | `title` and sentence. The title is in the primary ink, as the web kit draws it, where the older phone board colours it.                                                                                       |
| `Banner icon={WifiOff}`                   | Reuse   | The info tone with `OFFLINE_BANNER.title`, as the Dashboard and Recipes do.                                                                                                                                   |
| `Card asChild padding="none"` + `ListRow` | Reuse   | The status row, in a `ul`, as `GoalScreen` does. It sits in a wrapper with `role="status"` and `aria-live="polite"` that stays mounted from preparing to downloaded, as on the phone.                         |
| `ListRow`                                 | Extend  | A trailing tick, `trailing={{ kind: "tick", label }}`, as the mobile kit's: `Check`, 20 px, `text-success`, with the label as its accessible name. And `overflow-wrap: anywhere` on the title for a long name. |
| `ListRow icon`                            | Reuse   | `FileJson`, and `LoaderCircle` with `animate-spin` and `motion-reduce:animate-pulse` passed in as the icon. The board is still, so the spin is not drawn.                                                     |
| `Button`                                  | Reuse   | Primary and secondary, 44 px. `disabled` for Save file. `max-md:w-full` on a phone.                                                                                                                           |
| `GroupedList`, `ListRow`                  | Reuse   | The new row on More: `title`, `subtitle` and `href="/more/export"`, inside the Account list, whose `form` already wraps Sign out.                                                                             |

The footer is new layout from kit parts. In the DOM it is the buttons, Save file then Done, then the caption. At `md` and up it is `flex-row-reverse items-center gap-4`, with the buttons in `flex-row-reverse gap-2` and the caption `flex-1`, so the caption is on the left and the main button is at the far right. Below `md` it is a column of full-width buttons with the caption centred under them, as on the phone.

## New strings

In `packages/core/src/copy/accountExport.ts`, beside `ACCOUNT_EXPORT_COPY`. The first rewords the ticket's line, as "Where the sources disagreed" explains.

- Ready footer: "Save file downloads it through your browser. It stays in your downloads until you move or delete it."
- Downloaded tick label: "Downloaded"
- Downloaded footer: "Find it in your browser's downloads. If it is not there, open Export my data again."
- Offline body: "Preparing your file needs a connection. It starts when you're back online."
- `describeExportDownloaded(sizeText)`: "1.8 MB · Downloaded", beside `describeExportSaved`.

Suggested shape: `ACCOUNT_EXPORT_WEB_COPY = { ready: { footer }, saved: { tickLabel, footer }, offline: { body } }`. Everything else on the boards exists. The phone's `ready.footer` and `saved.footer` name a phone and a Files app, so the web must not print them.

## Decisions

- **Recommended (Zee away), reversible:** the export is in scope for the web although it was built in M8. It is a person's right to their data, not an assistant screen, and the file holds the assistant conversations, as it does on the phone. From the ticket.
- **Recommended (Zee away), reversible:** Save file is a browser download of `ki-lo-export-<date>.json`, because the web has no folder picker, and the saved state reads "Downloaded" because it cannot name a folder. From the ticket.
- **Recommended (Zee away), reversible:** Export is a page at `/more/export`, as it is a screen on the phone. From the ticket.
- **Recommended (Zee away), reversible:** the sub line reads "1.8 MB · Downloaded", and the ready sub line stays `describeExportReady`, "1.8 MB · Ready to save". The ticket asks for "a web saved line" without its words. I read that as this sub line, and added the footer "Find it in your browser's downloads. If it is not there, open Export my data again." The phone's footer has to go, and the state otherwise does not say where the file is. The second sentence is there because the page drops its copy and cannot confirm the download, and opening the page again prepares a new file.
- **Recommended (Zee away), reversible:** the offline board is new, because the phone has no offline state: a phone that loses its connection lands on The export did not finish. The web draws it as Goal and Recipes do, with `useIsOnline`, a banner and the action off. The rule for when it shows and when the file is prepared again is the next decision.
- **Recommended (Zee away), reversible:** the offline board and its retry follow this rule, so the body's promise is always true.
  - **Not a reducer state.** The board is derived from `useIsOnline` when the page renders. `accountExportReducer` does not change. The hook keeps one ref, "the last failure happened while offline", set in the catch from the online state at that moment and cleared by any retry.
  - **When the board shows.** The browser is offline and the status is `idle` or `preparing`, or the status is `failed` and that ref is set.
  - **The silent prepare.** It runs only for a failure that happened while offline, and once per offline-to-online change. It sends the existing `retry` event, with no press.
  - **A failure that happens online.** It stays on the failed board with Try again, whether or not the connection later drops, and a later reconnect does not retry it. Only the person's press does. Try again pressed while offline goes back to `preparing`, which shows the offline board, and that attempt failing offline sets the ref.
  - **A silent prepare that fails.** The connection is back, so that is an online failure: the failed board with Try again, and no further silent attempt until another offline-to-online change after a failure offline.
- **Recommended (Zee away), reversible:** a file that is ready stays ready offline, with no banner. It is already in the browser, so Save file and Done still work. Only the top bar's launcher dims. No board is drawn for this, as it is `export-ready` with that one change.
- **Recommended (Zee away), reversible:** the web has no saving state to draw. A download starts at once with no picker to wait for, so `accountExportReducer` runs `save` then `savedTo` in the same press with an empty folder name. `pickerCancelled` is never sent. A browser does not tell the page whether the person went on to cancel its own download, so "Downloaded" means it was handed to the browser.
- **Recommended (Zee away), reversible:** after the download the file is dropped, so the page offers Done only, as on the phone. Coming back to the page prepares a new file.
- **Recommended (Zee away), reversible:** the file's text is handled as on the phone, in a ref and never in React state, a query cache or a log. It goes into a Blob and a temporary object URL that is revoked after the click, and it is dropped on leaving the page. A failure is reported as the step that failed, and the error is never read.
- **Recommended (Zee away), reversible:** the page prepares the file as it opens, as the phone does on focus, with no Start button. Leaving by the top bar unmounts the page, which is the same as the phone's blur.
- **Recommended (Zee away), reversible:** the web row on More has no icon, where the phone's has `Download`, because no row of the web More page has one.
- **Recommended (Zee away), reversible:** at 1280 the buttons sit at the right of one row with the caption on their left, as `GoalSummaryScreen` puts its actions, not in the phone's full-width stack. At 375 they are the phone's stack.
- **Recommended (Zee away), reversible:** `web-more · export-row` draws the More page as merged, with the Goal row, the Body map setting and the Dashboard body map setting together. The older `shell-more*` and `more-body-map-setting*` boards each lack some of these.

## Where the sources disagreed

- The phone board colours the failed title in danger and draws the progress icon in the accent ink. The web kit draws the banner title in the primary ink and a `ListRow` icon in the secondary ink. The boards follow the web kit, as the brief says the web boards decide how things look.
- The phone board's warning banner has no border, and the web kit's review tone has one. The boards follow the web kit.
- The canvas says "Dark · Saved, after the folder picker", and "1.8 MB · Saved to Downloads". The web has no picker, so the ticket's "Downloaded" wins.
- The ticket's ready footer read "The file stays there until you move or delete it", where "there" had nothing to point at on the web, as there is no folder as on the phone. After review the board reads "It stays in your downloads until you move or delete it", so this outranks the ticket's wording. Zee may want to look at it when he reviews.

## Not on these boards

Any app code and the phone. `docs/design/web/README.md` does not list these boards, by the ticket's rule.
