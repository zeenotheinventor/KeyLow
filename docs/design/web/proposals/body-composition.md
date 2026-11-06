# web body composition

Web, the Body composition cards on the Weight page, the Composition view of the chart and what the web says with no readings ([KEY-845](https://linear.app/sojisoft/issue/KEY-845), part of [KEY-5](https://linear.app/sojisoft/issue/KEY-5) and [KEY-655](https://linear.app/sojisoft/issue/KEY-655)). These are the design gate of [KEY-861](https://linear.app/sojisoft/issue/KEY-861) (cards) and [KEY-866](https://linear.app/sojisoft/issue/KEY-866) (view). Zee reviews after the build.

Each board is a PNG at device pixel ratio 2 and a standalone HTML page that opens from `file://`, links `packages/tokens/css/kilo-tokens.css` by relative path and uses token references only, no raw hex. The frames are 1280 dark, 1280 light, 375 dark and 375 light, from left to right. A frame is as tall as its page, at least 812. The heading is the page title of each HTML file. The chrome, the trend card and the Weigh-ins list are the `web-weight, page-chart` board, unchanged.

## Numbers

The phone board's own mock series (17 Oct 2026, one reading on each scale weigh-in), run through the real core functions: `computeBodyTrend`, `bodyChangeOverRange`, `composeBodySplit`, `prepareBodyCompositionChart` and the `describe*` functions in `packages/core/src/copy/bodyComposition.ts`. The series is shifted so the cards print the phone board's figures: body fat 22.4 %, −0.6 points over 90 days, and lean mass 63.1 kg, −0.2 kg over 90 days.

The view's lean mass is 63.7 kg where the card reads 63.1 kg. That is the rule and not a slip: the view works lean mass out from body fat and the trend weight, and the card is the trend of the lean mass readings. The figure prints no value, so the gap shows only in the figure's accessible name and the marker's position. It comes from the mock series being shifted to hit the phone board's figures. Real scales report the two together and they nearly agree, so a gap this size on these boards is not a bug in [KEY-866](https://linear.app/sojisoft/issue/KEY-866).

## Boards

### web-weight, body-composition-cards

`body-composition-cards`. Under the chart's legend, the heading, a Body fat card and a Lean mass card, side by side at 1280 and stacked at 375, then the caption. Each card has its label, the change badge, the value, the unit and the 128 by 40 line.

### web-weight, body-composition-one-kind

`body-composition-one-kind`. Only body fat has readings: one card across the column, with no caption, since the caption shows only with a lean mass card. With only lean mass, the same layout has the Lean mass card and the caption. The kind with no readings draws nothing.

### web-weight, body-composition-settling

`body-composition-settling`. Three readings: the Settling badge, no change, "Settles after 7 readings. 3 of 7 so far." and the line placed by date. At 90 days three days of line sit at the right end and look nearly upright. The merged phone card's logic gives the same.

### web-weight, body-composition-range-empty

`body-composition-range-empty`. Not on the ticket's list. It is the phone's `one-range-empty` state, kept so no state is lost: 1 week chosen, fewer than two readings in it, the value and the reason, no badge and no line.

### web-weight, body-composition-view-kg

`body-composition-view-kg`. Composition chosen, in kg. The two plots replace the chart and its legend. Under them, the kg and % switch, the source line and the caption, then the heading and the cards with no second caption. The board's source line is the body fat branch of `describeCompositionSource`. When lean mass drives, because there is no body fat trend at all, the line is "Worked out from your lean mass and trend weight."

### web-weight, body-composition-view-pct

`body-composition-view-pct`. The same in %. The lines are per cent of the trend weight, so they add up to 100.

### web-weight, body-composition-view-settling

`body-composition-view-settling`. The driver has three readings: both lines dashed, 5 on and 4 off, and the Settling badge at the left of the switch's row. Drawn on 1 week so the dashes can be seen, and at 90 days the same three days sit at the right end. The cards under it settle too.

### web-weight, body-composition-view-no-readings

`body-composition-view-no-readings`. Not on the ticket's list, and KEY-866 asks for it. Composition chosen with no readings: the quiet line in the figure's place. The section under it draws nothing, not even its heading, as on the phone.

### web-weight, body-composition-view-loading

`body-composition-view-loading`. Not on the ticket's list. Composition chosen while the readings load: one shape of the figure's size, named `BODY_COMPOSITION.loadingLabel`. The section under it draws nothing.

### web-weight, body-composition-view-error

`body-composition-view-error`. Not on the ticket's list. Composition chosen, the read failed with nothing to show: the error state in the figure's place, whose Try again reads the failed kinds again. A split that can still be worked out from the other kind is drawn in place of this, as on the phone.

### web-weight, body-composition-no-readings

`body-composition-no-readings`. The heading over one quiet line, in place of the phone's `no-readings-yet` and `not-allowed` prompts. No permission, no link and no action.

### web-weight, body-composition-loading

`body-composition-loading`. The heading over one status region, named `BODY_COMPOSITION.loadingLabel`, with two 104 high shapes, one for each card.

### web-weight, body-composition-error

`body-composition-error`. The heading over the error state, with Try again.

### web-weight, body-composition-offline-nothing-read

`body-composition-offline-nothing-read`. Not on the ticket's list. Offline with nothing read: the error state with no Try again, since a read goes ahead by itself when the connection returns. This is what `WeightScreen` does for the weigh-ins.

### web-weight, body-composition-explainer

`body-composition-explainer`. The `explainer-default` dialog with `TREND_EXPLAINER_BODY_SECTION` as the sixth section, after Weekly rate. At 812 high the dialog fits at 1280. The 375 frame is 815 here so the whole sheet shows, and a real 812 window scrolls the 3 px.

## Offline

There is no `body-composition-offline` board, though [KEY-861](https://linear.app/sojisoft/issue/KEY-861) and [KEY-866](https://linear.app/sojisoft/issue/KEY-866) name one, because there is nothing different to draw. Readings already read in this session stay as they are, with no notice, so the state looks like `body-composition-cards`, `-settling` or `-view-kg`, whichever was showing. The range control still works, since it only filters. The merged `WeightScreen` draws nothing offline when weigh-ins are loaded, so a notice on one section would make the page contradict itself and shift the layout when the connection flaps. Offline with nothing read is `body-composition-offline-nothing-read`.

## New string

In `BODY_COMPOSITION`, in `packages/core/src/copy/bodyComposition.ts`, added by [KEY-861](https://linear.app/sojisoft/issue/KEY-861).

- `BODY_COMPOSITION.noReadingsWeb`: "No body fat or lean mass readings yet. They come from a smart scale, through Health Connect in the Ki-Lo phone app."

The web does not use `BODY_COMPOSITION.notAllowed`, `.noReadings` or `.partial`.

## Kit

Reuse: `Card`, `Badge` (accent, warning), `SegmentedControl` (`md` for Chart view and the range, `sm` at 112 wide for kg and %), `SkeletonBone`, `Skeleton`, `ErrorState` (`list` size, with `onRetry` left off offline), `Dialog`, `Button`.

Extend: `WeightTrendCard` and `WeightScreen` take the switch and the view, as the phone's do. `TrendExplainerDialog` gains the sixth section.

New: `Sparkline` ([KEY-858](https://linear.app/sojisoft/issue/KEY-858)), wide size: line 2, dot 3.5 with a 2 ring in the surface colour. `BodyCompositionCard`, `BodyCompositionSection`, `BodyCompositionChart`, `BodyCompositionView` in `apps/web/components/weight/`.

The boards draw the badge in `--accent-ink` and `--warning-ink`, as `page-chart` does. The kit `Badge` picks its own ink, and the build uses the kit.

## Build notes

- The composition figure is the same box as `WeightChart`: 12 of top padding, the drawing (220 high from the large breakpoint and 160 under it) and the 30 high labels, so the switch does not move the page. The drawing holds two plots with an 8 gap, 106 high each at 1280 and 76 at 375, the phone's size. Each plot keeps the phone's padding (left 12, right 44, top 16, bottom 8), its own axis from `buildAxis`, its caption at top left and a marker of radius 4.5 on the latest value.
- The cards are `grid gap-2 lg:grid-cols-2`, and a lone card spans both columns.
- The chart view switch is on every board because that is where the page ends up. It arrives with [KEY-866](https://linear.app/sojisoft/issue/KEY-866), so [KEY-861](https://linear.app/sojisoft/issue/KEY-861) builds the same boards without it.
- Offline, React Query pauses a read, so a kind with no data is neither failed nor finished. The section checks `useIsOnline` as `WeightScreen` does, and draws `body-composition-offline-nothing-read` and not the loading shapes.
- Body data is not in the offline cache. Readings that stay offline are what is still in memory from this session.

## Decisions for Zee to check after the build

1. Recommended (Zee away), reversible: the web has no Health Connect, so it asks for no permission and has no link to a permission flow. Whatever is stored shows, read only. The phone's `not-allowed` prompt becomes one quiet line saying readings arrive from the phone app.
2. Recommended (Zee away), reversible: the web's Weight page reads both kinds as allowed, since the phone's `access` is a question only the phone can answer. So `partial` and `not-allowed` have no board.
3. Recommended (Zee away), reversible: the chosen Weight or Composition view is kept in this browser, as mobile keeps it on the device. The kg or % choice is kept with it, as the phone keeps both.
4. Recommended (Zee away), reversible: the quiet line says there are no readings yet and where they come from, a smart scale through Health Connect in the phone app. It names the scale because the phone app alone is not enough: `getHealthProvider` returns a provider only on Android, and a scale may not record these. It replaces the phone's `no-readings-yet` words, which tell the person to weigh in and do not name the phone app.
5. Recommended (Zee away), reversible: at 1280 the two cards sit side by side in the left column, where the phone stacks them, so the page stays short. At 375 they stack as on the phone.
6. Recommended (Zee away), reversible: no offline notice on the section. The web Weight page has no offline notice, so cached readings stay as they are. A page-wide notice is a separate call, for the whole page and not for this section.
7. Recommended (Zee away), reversible: errors use the kit `ErrorState`, as [KEY-861](https://linear.app/sojisoft/issue/KEY-861) names it, not the phone's 32 point tile prompt. It is taller and matches the web's other error states.
8. Recommended (Zee away), reversible: the view's loading state is one shape of the figure's size, not the phone's two 104 shapes, so the page does not jump when the figure arrives.
9. Recommended (Zee away), reversible: settling lines and the source line are 14 over 20 at the regular weight. The canvas is the source for this, in its card note, and the web's trend card line matches it. The merged phone's semibold label style is the outlier, so do not change these back to match the phone.

## Where the sources disagreed

- The canvas draws a settling card with no line, and the merged phone card draws the line when the range holds a point. The merged screen is used.
- The `page-chart` board says "2 Sept" and `describeChartDate` gives "2 Sep". The copy function is used, so these boards say "2 Sep".
- `web-weight/proposals/README.md` and `TrendExplainerDialog` both say the web has no Composition and no sixth section. These boards replace that once [KEY-861](https://linear.app/sojisoft/issue/KEY-861) and [KEY-866](https://linear.app/sojisoft/issue/KEY-866) ship.
