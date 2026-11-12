# Form videos

The curated YouTube video for each of the library exercises listed in `form-videos.csv`. The
migration `supabase/migrations/20261111110000_exercise_form_videos_seed.sql` is generated from that
file and fills `public.exercise_form_videos` (KEY-957), which `exercise_form_media` reads.

## How the list was picked

- The exercises are the common compound and isolation lifts of the curated library
  (`exercises.curated.csv`), keyed by `source_ref`. None is in `exercises.excluded.csv`.
- Every video was found by searching YouTube, then proved real by its oEmbed answer. No id was
  typed from memory. The `title` and `channel` columns are exactly what oEmbed returned.
- A short single-exercise technique video was preferred over a programme video, and a small set of
  consistent channels over one channel per lift.
- The library has no Bulgarian split squat, so the plain `Split_Squat_with_Dumbbells` is seeded.
- Lifts with no reputable single-exercise video found are not seeded (for example the decline bench
  press and the seated calf raise). A surface without a video shows the free-exercise-db photos.

## Channels

| Channel                        | Rows | Why                                                                                                                                                                          |
| ------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renaissance Periodization      | 80   | Exercise scientists and coaches. Its library of 10 to 20 second demonstrations covers one exercise each, so it gives consistent coverage of the isolation and machine lifts. |
| Jeff Nippard                   | 10   | Natural bodybuilder and powerlifter with a science-based "perfect technique" series, used for the main compound lifts.                                                       |
| Bret Contreras Glute Guy       | 1    | Bret Contreras, the researcher and coach who popularised the hip thrust, for the glute bridge.                                                                               |
| Squat University               | 1    | Physical therapist Aaron Horschig, for the dead bug.                                                                                                                         |
| Eric Cressey                   | 1    | Established strength coach, for the goblet squat.                                                                                                                            |
| Alan Thrall (Untamed Strength) | 1    | Established barbell coach, for the push press.                                                                                                                               |
| E3 Rehab                       | 1    | Physical therapy channel with clear technique cues, for the plank.                                                                                                           |
| Get Exercise Confident         | 1    | Physiotherapist-led channel, for the step-up.                                                                                                                                |

## Re-verify

```sh
pnpm --filter @keylow/db verify:form-videos
```

It fetches the oEmbed answer for each row, prints one line per row and a final count, and exits
non-zero if any row is not a 200 with the same title and channel. It waits 300 ms between requests
and sends a generic User-Agent and no account data. Run it by hand, never in CI, because CI must
not depend on YouTube.

To add a row, append `source_ref,youtube_video_id,,,` to `form-videos.csv` (keeping the file sorted
by `source_ref`) and run `pnpm --filter @keylow/db verify:form-videos --write`. That fills the title,
channel and date from oEmbed. Then emit a new migration, never editing one that has been applied:

```sh
pnpm --filter @keylow/db verify:form-videos --emit-migration supabase/migrations/<timestamp>_exercise_form_videos_seed.sql
```

## Last full verification

96 of 96 verified on 2026-11-11.
