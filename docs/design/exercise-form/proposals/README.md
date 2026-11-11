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

Drawn by KEY-960.

### routine-editor-exercise

Drawn by KEY-961.

### assistant-card

Drawn by KEY-962.
