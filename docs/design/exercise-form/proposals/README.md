# exercise-form proposals

Exercise form media · how an exercise is done · `apps/mobile/components/ui/FormMediaCard`

The exercise form media feature shows how an exercise is done in three places: the live workout's exercise sheet, the routine editor and the assistant chat. It has no exported board. This folder holds hand-drawn proposals for it, built from the kit tokens and primitives (`Card`, `PressableSurface`, `Text`, `Icon`, `Badge`, `Skeleton`). They are not on the canvas, so they sit in `proposals/` where `tools/design-export` does not look for boards. Each PNG is 820 by 844 at device pixel ratio 2, dark on the left and light on the right.

## Boards

### form-media-card

The shared card that all three places use, with every state stacked, top to bottom: the video, the photos alternating, the photos with Reduce Motion on, loading, unavailable, and a video whose thumbnail failed to load.

![form-media-card](form-media-card.png)

Open [form-media-card.html](form-media-card.html) in a browser.

- **Video.** One pressable card, role `link`, named "Watch <title> by <channel> on YouTube". A 16:9 thumbnail at 128 by 72 with a play glyph over it, the title (two lines at most), the channel, and under a hairline the line "Opens in YouTube" in the accent ink with a chevron, as `AssistantLinkRow` draws its last line. The thumbnail is cropped to 16:9 with cover, because YouTube's `hqdefault.jpg` is 4:3 with letterbox bars. The board uses a neutral placeholder, never a real thumbnail.
- **Photos, alternating.** The start photo and the end photo take turns in one 2:1 stage, crossfading, about 1.5 seconds each. A "Start" or "End" badge sits on the photo.
- **Photos, Reduce Motion.** Both photos side by side, 3:2 each, each with its badge, and nothing moves.
- **Loading.** The skeleton of the video card.
- **Unavailable.** One quiet line, for offline or a failed read. No icon and no error colour.
- **Image failed.** The placeholder tile (the camera-off glyph on the raised surface, named "Image not available") in place of a thumbnail or a photo that did not load. The card still opens the video.

### session-exercise-sheet

The live workout's exercise sheet (the "Muscles it works" sheet the exercise card opens from its name or its body icon) with the form card in it. Three boards, each dark on the left and light on the right, 820 by 844 at device pixel ratio 2. The sheet is drawn as the app draws it today: the handle, the exercise name, the "Muscles it works" caption, the front and back figures coloured by role, the role rows and the explanation.

**Video.** [session-exercise-sheet.html](session-exercise-sheet.html)

![session-exercise-sheet](session-exercise-sheet.png)

**Photos fallback.** [session-exercise-sheet-photos.html](session-exercise-sheet-photos.html)

![session-exercise-sheet-photos](session-exercise-sheet-photos.png)

**Loading (dark) and unavailable (light).** [session-exercise-sheet-states.html](session-exercise-sheet-states.html)

![session-exercise-sheet-states](session-exercise-sheet-states.png)

- **Placement.** The card sits directly under the exercise name and above the "Muscles it works" caption. Form is what a lifter wants mid-set, so it comes before the muscles, and the caption then labels the figure and the rows under it, as a section label. The card is the same `FormMediaCard` the routine editor and the assistant draw, with no wrapper of its own and no section heading, so the sheet needs no new copy.
- **Spacing.** The card has 12 above and 12 below, the same as the gap between the other blocks of the sheet. The sheet's body has no gap between the name and the caption (2), so the card's own padding makes up the rest.
- **Custom exercise.** An exercise with no media (a custom exercise, or a library exercise with neither a video nor photos) draws nothing for the form. There is no card, no padding and no gap, so the sheet is the one the app draws today, name and caption 2 apart.
- **Loading and unavailable.** Both take the card's place, and the card that was shown stays on show as the sheet closes. The loading card is the skeleton of the video card. The unavailable card is one quiet line, when the phone is offline or the read failed, and the muscles part of the sheet behaves as it does today. A custom exercise shows the loading card for as long as the read takes, then the card closes up and the sheet moves up with it.
- **Height.** The photos card is 2:1, so it is the tallest, and with it the sheet is 838 points tall in the 844 point frame (804 of content and 34 of home indicator). The board draws a phone tall enough for that. A shorter phone does not get a shorter sheet. The sheet stops below the status bar and its contents scroll. On a 375 by 667 phone (20 points of status bar, no home indicator) the sheet is at most 647 points tall, against about 804 of contents with the photos card, 766 with the video card and 601 with no card. So the photos sheet scrolls by about 157 points, the video sheet by about 119, and a sheet with no card does not scroll, as today. With the 3D body the stage (240 and its switch) replaces the figures (264), so the contents are about 830 with the photos card and scroll in the same way. The stage sits in the scroll view as it does on the body map screen, and a drag on it should turn the body and not scroll. That wants a check on a device.
- **3D body.** The card keeps its place above the caption and the stage. It is an ordinary pressable, so it presses while the body turns under a drag. The sheet does not draw it.
- **Reduce Motion.** The photos card draws both photos side by side, as `form-media-card` shows. The sheet does not repeat it.
- **Words.** Every word of the card comes from `packages/core/src/copy/exerciseForm.ts`. The sheet adds none, and the figure, rows and explanation are the sheet's own.

### routine-editor-exercise

Drawn by KEY-961.

### assistant-card

Board name `assistant-card · exercise-form`. The form guide of an exercise as a card in the assistant thread, under a short reply, the way the muscles card sits under its reply. The sheet is at full height, as it is for the muscles card, with the quiet header, the person's question, the reply and the card above the composer. There are two boards so that both kinds show in both themes: `assistant-card` has the video in dark and the photos in light, and `assistant-card-photos` has the photos in dark and the video in light.

![assistant-card](assistant-card.png)

![assistant-card-photos](assistant-card-photos.png)

Open [assistant-card.html](assistant-card.html) and [assistant-card-photos.html](assistant-card-photos.html) in a browser.

- **The reply.** One short line, "Here is a form guide for the barbell squat." It never says "I" (KEY-956). The prompt shapes it, so it is not app copy.
- **The card.** `FormMediaCard`, unchanged, straight under the reply with the thread's 12 point gap. The video card opens YouTube. The photos card alternates the start and end photo, and sits side by side with Reduce Motion on, as `form-media-card` shows.
- **Where it sits.** After the reply and before any link, notice or Ask again, whether the turn is live or stored. A stored conversation reopened later draws the same card with no read.
- **Words.** Every word of the card is from `copy/exerciseForm.ts`. The sheet's words are the existing assistant copy. The board uses a neutral placeholder, never a real thumbnail or photo.
