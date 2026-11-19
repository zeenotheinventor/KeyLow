# Ki-Lo achievements and streaks: spec

Status: approved by Zee on 2026-11-19, including the KEY-1081 rulings. This file is the spec the
Linear tickets under KEY-1079 point at.

## Principles

- Reward behaviour, never body outcomes. Ki-Lo is a health app, so no badge for kilos lost, a big
  calorie deficit, a low-calorie day or skipping meals. Target badges are for landing inside your
  range, which can mean eating more.
- Every achievement maps to data Ki-Lo already stores (diary entries, weigh-ins, measurements,
  workout sessions and sets, recipes, meal plans, shopping list, check-ins, the assistant).
- Rules live in `@keylow/core` as pure functions over a stats snapshot, so they are unit-tested and
  shared by mobile and web.
- Existing users are backfilled on first launch: everything they already earned unlocks quietly,
  with one summary card ("You have already earned 23 achievements") instead of 23 celebrations.
- Each achievement has a tier: Bronze, Silver, Gold or Platinum. The section "Hidden and seasonal"
  (123 to 128) shows as "???" until earned. Everything else, including Collector and
  Completionist, is visible with its progress.

## Streaks

| Streak | Unit | A period counts when | Shown on |
| --- | --- | --- | --- |
| Daily streak (the main one) | day | you tap "Day complete" in the Diary for that local day | Dashboard chip, Diary header |
| Training streak | week (Mon to Sun) | you finished as many sessions as your training goal's days per week in force that week, else your active routine's day count, else 3 | Train tab |
| Weigh-in streak | week | at least one weigh-in that week | Weight screen |

- Days follow the user's local date, the same `local_date` the diary already uses, so travelling
  never breaks a streak.
- Today is "at risk", not broken, until local midnight. Because yesterday can still be completed
  until 12:00, a missed day is only settled (a freeze used, or the streak reset) at 12:00 the next
  day.
- "Day complete" sits at the bottom of the Diary. It needs at least one entry that day and can be
  undone until midnight. Yesterday can still be completed until 12:00 today, for late eaters who
  forget before bed.
- Streak freezes have no cap: stock up as many as you earn. One is used automatically for each
  missed day, and the calendar marks a frozen day with a snowflake. Ways to earn one:
  - every 7 days in a row on the daily streak
  - every week the training streak continues
  - every 4 weeks the weigh-in streak continues
  - every Perfect Week (calories and protein in range for 7 days)
  - every level reached
  - every Gold achievement (one freeze) and every Platinum achievement (three freezes)
  - the first time you use each Ki-Lo feature listed under Getting started
- Training and weigh-in streaks are weekly, so they use no freezes.
- Longest streak is kept for ever, separately from the current one.
- Optional evening nudge ("Complete today to keep your 12-day streak") goes through the existing
  Reminders screen as its own switch, off by default, and never fires on a day already completed.

## Points and levels

Bronze 10 points, Silver 25, Gold 50, Platinum 100. Levels use a gentle curve (level n needs
50 x n x (n + 1) / 2 points in total), named in sets of five: Sprout, Sapling, Oak, Summit, Legend.
Points never go down.

## Where it lives

- More > Achievements: level and points at the top, then the catalogue grouped by category with
  progress bars ("37 of 50 days") on locked ones.
- A streak chip on the Dashboard that opens a streak calendar.
- An unlock toast with a short haptic, and a full-screen moment for Gold and Platinum only.

## Unlock notifications

- Every unlock sends a notification: "Badge earned: Hat Trick", body "3 days complete in a row.
  +10 points". When a freeze or a new level comes with it, the body says so ("+1 freeze",
  "You reached Sapling").
- Tapping it opens that badge on the Achievements screen.
- Several unlocks from one action become one notification ("3 badges earned: Hat Trick, Notebook
  and Bullseye") so a busy log never sends a burst.
- If Ki-Lo is open, the in-app toast shows instead, so you never see both.
- Level-ups get their own notification only when no badge came with them.
- The first-launch backfill never notifies. Existing users get the single summary card.
- Its own switch, "Badges and levels", on the Reminders screen, on by default, with an Android
  channel `achievements`.
- How it is sent: unlocks are worked out on the phone right after each write, so these are local
  notifications through the same `expo-notifications` setup the reminders use. No server push is
  needed, and none of the Firebase setup that was parked with KEY-1069.
- Gap: an unlock earned on the web app reaches the phone only the next time Ki-Lo opens (toast,
  not a notification). Phone notifications for web actions need server push, which waits on the
  Firebase setup. That is a follow-up, not part of this build.
- Design gate: these screens need frames in `docs/design/achievements/` before any screen ticket.

## The catalogue (130)

### 1. Getting started (12)

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 1 | First Bite | logging your first food | Bronze |
| 2 | Set the Course | finishing setup with your targets | Bronze |
| 3 | On the Scales | recording your first weigh-in | Bronze |
| 4 | Beep Beep | scanning your first barcode | Bronze |
| 5 | Home Cook | saving your first recipe | Bronze |
| 6 | Soft Spot | favouriting a food or recipe | Bronze |
| 7 | First Rep | finishing your first workout | Bronze |
| 8 | Planner | planning your first day of meals | Bronze |
| 9 | Hello, Ki-Lo | asking the assistant your first question | Bronze |
| 10 | Nudge Me | turning on a reminder | Bronze |
| 11 | Measured Up | your first body composition reading from Health | Bronze |
| 12 | Closing Time | completing your first day | Bronze |

### 2. Logging volume (11)

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 13 | Jotter | 10 entries logged | Bronze |
| 14 | Notebook | 50 entries | Bronze |
| 15 | Centurion | 100 entries | Silver |
| 16 | Quarter Master | 250 entries | Silver |
| 17 | Diarist | 500 entries | Gold |
| 18 | Grand Log | 1,000 entries | Gold |
| 19 | Archivist | 2,500 entries | Platinum |
| 20 | Encyclopaedia | 5,000 entries | Platinum |
| 21 | A Month of Meals | 30 different days logged | Silver |
| 22 | Hundred Days | 100 different days logged | Gold |
| 23 | Year in the Book | 365 different days logged | Platinum |

### 3. Daily streaks (14)

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 24 | Hat Trick | 3-day daily streak | Bronze |
| 25 | Full Week | 7-day streak | Bronze |
| 26 | Fortnight | 14-day streak | Silver |
| 27 | Habit Forming | 21-day streak | Silver |
| 28 | Month Strong | 30-day streak | Gold |
| 29 | Two Months | 60-day streak | Gold |
| 30 | Quarter Year | 90-day streak | Gold |
| 31 | Half Year | 180-day streak | Platinum |
| 32 | Full Circle | 365-day streak | Platinum |
| 33 | Unstoppable | 500-day streak | Platinum |
| 34 | Back on Track | completing a day after 3 or more days off | Bronze |
| 35 | Saved by the Snow | a freeze keeps your streak alive | Bronze |
| 36 | Weekend Warrior | completing every Saturday and Sunday for 4 weekends | Silver |
| 37 | Stockpile | holding 10 freezes at once | Silver |

### 4. Targets (12)

"In range" means within the meal-plan fit tolerance (`toleranceOf` in
`packages/core/src/recipes/fit/judgeTargets.ts`) of that day's target: the engine target in force,
else your own targets. The day must be complete. Protein counts when you reach at least the target,
so going over is fine. Being under range never counts.

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 38 | Protein Pioneer | hitting your protein target for a day | Bronze |
| 39 | Protein Week | 7 days on protein target | Silver |
| 40 | Protein Month | 30 days on protein target | Gold |
| 41 | Protein Pro | 100 days on protein target | Platinum |
| 42 | Bullseye | calories in range for a day | Bronze |
| 43 | Steady Hand | 7 days with calories in range | Silver |
| 44 | Dialled In | 30 days with calories in range | Gold |
| 45 | Precision | 100 days with calories in range | Platinum |
| 46 | Balanced Plate | calories, protein, carbs and fat all in range on one day | Silver |
| 47 | Perfect Week | 7 days in a row with calories and protein in range | Gold |
| 48 | Fibre Fan | 7 days reaching 25 g of fibre | Silver |
| 49 | Morning Logger | logging before 10:00 on 30 days | Silver |

### 5. Variety (9)

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 50 | Taster | 25 different foods logged | Bronze |
| 51 | Varied Diet | 50 different foods | Silver |
| 52 | Adventurous | 100 different foods | Gold |
| 53 | Omnivore | 250 different foods | Platinum |
| 54 | Explorer | 10 foods you had never logged before, in one week | Silver |
| 55 | Creature of Habit | logging the same favourite 30 times | Bronze |
| 56 | Scanner | 10 different barcodes scanned | Bronze |
| 57 | Barcode Collector | 50 different barcodes | Silver |
| 58 | Checkout Champion | 100 different barcodes | Gold |

### 6. Kitchen (10)

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 59 | Recipe Box | 5 recipes saved | Bronze |
| 60 | Cookbook | 10 recipes saved | Silver |
| 61 | Head Chef | 25 recipes saved | Gold |
| 62 | Regular | logging your own recipes 10 times | Bronze |
| 63 | House Special | logging your own recipes 50 times | Silver |
| 64 | Batch Cook | one recipe logged on 3 different days | Bronze |
| 65 | Week Ahead | a full 7-day meal plan | Silver |
| 66 | Master Planner | 4 weeks of meal plans | Gold |
| 67 | List Maker | your first shopping list | Bronze |
| 68 | Basket Case | 50 shopping items ticked off | Silver |

### 7. Training volume (15)

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 69 | Routine Builder | creating your first routine | Bronze |
| 70 | Warmed Up | 5 workouts | Bronze |
| 71 | Ten Down | 10 workouts | Bronze |
| 72 | Regular at the Rack | 25 workouts | Silver |
| 73 | Fifty Sessions | 50 workouts | Silver |
| 74 | Hundred Club | 100 workouts | Gold |
| 75 | Iron Habit | 250 workouts | Platinum |
| 76 | Lifer | 500 workouts | Platinum |
| 77 | Set Counter | 100 sets | Bronze |
| 78 | Thousand Sets | 1,000 sets | Gold |
| 79 | Ten Thousand | 10,000 sets | Platinum |
| 80 | Ten Tonnes | 10,000 kg lifted in total (sets x reps x load) | Silver |
| 81 | Hundred Tonnes | 100,000 kg lifted | Gold |
| 82 | Megalifter | 1,000,000 kg lifted | Platinum |
| 83 | Big Session | one workout with 25 or more sets | Silver |

### 8. Training consistency (8)

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 84 | Two Good Weeks | 2-week training streak | Bronze |
| 85 | Four Weeks Solid | 4-week training streak | Silver |
| 86 | Eight Weeks | 8-week training streak | Silver |
| 87 | Quarter of Graft | 12-week training streak | Gold |
| 88 | Half a Year of Iron | 26-week training streak | Platinum |
| 89 | Year of Iron | 52-week training streak | Platinum |
| 90 | Early Bird | 10 workouts started before 07:00 | Silver |
| 91 | Night Owl | 10 workouts started after 21:00 | Silver |

### 9. Strength and range (8)

A personal record is a session whose best counted set for an exercise beats every earlier
session's best by the existing `isBetter` rule (`packages/core/src/training/exerciseTrend.ts`):
heavier load, then more reps at that load, warm-ups excluded. An exercise's first session is never
a record.

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 92 | Personal Best | your first personal record (see the note above this table) | Bronze |
| 93 | On a Roll | 10 personal records | Silver |
| 94 | Record Breaker | 50 personal records | Gold |
| 95 | Hall of Fame | 100 personal records | Platinum |
| 96 | Full Body | all six main muscle groups (not neck) trained as a primary muscle in one week | Silver |
| 97 | Leg Day Legend | 25 workouts that train legs | Silver |
| 98 | Well Rounded | 50 different exercises | Gold |
| 99 | Form Check | watching an exercise demo | Bronze |

### 10. Weight and body (10)

Consistency only. No badge is tied to how much weight changed or to a weight goal.

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 100 | Weekly Weigh | 10 weigh-ins | Bronze |
| 101 | Data Driven | 50 weigh-ins | Silver |
| 102 | Trend Setter | 100 weigh-ins | Gold |
| 103 | Every Single Day | 365 weigh-ins | Platinum |
| 104 | Four Weeks Weighed | 4-week weigh-in streak | Bronze |
| 105 | Quarter Weighed | 12-week weigh-in streak | Silver |
| 106 | Year Weighed | 52-week weigh-in streak | Gold |
| 107 | Body Reader | 10 body composition readings | Silver |
| 108 | Morning Routine | 30 weigh-ins before 09:00 | Silver |
| 109 | Composition Collector | 50 body composition readings | Gold |

### 11. Programme and check-ins (6)

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 110 | Signed Up | 4 weeks on a programme | Bronze |
| 111 | Checking In | your first check-in | Bronze |
| 112 | Monthly Review | 4 check-ins | Silver |
| 113 | Quarterly Review | 12 check-ins | Gold |
| 114 | Graduate | 12 check-ins on one programme | Gold |
| 115 | Course Correct | editing your targets | Bronze |

### 12. Ki-Lo explorer (7)

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 116 | Chatterbox | 10 assistant conversations | Bronze |
| 117 | Hands Free | letting the assistant log a meal for you | Bronze |
| 118 | Sous Chef | the assistant drafting a recipe you save | Silver |
| 119 | Your Data | exporting your data | Bronze |
| 120 | Ideas Person | sending a feature request | Bronze |
| 121 | Favourites Fan | logging from favourites 25 times | Silver |
| 122 | Weekly Review | opening the week view 10 times | Bronze |

### 13. Hidden and seasonal (8)

| # | Name | Earn it by | Tier |
| --- | --- | --- | --- |
| 123 | New Year, New Log | logging on 1 January | Bronze |
| 124 | Festive Feast | logging on 25 December | Bronze |
| 125 | Spooky Snacks | logging on 31 October | Bronze |
| 126 | Leap of Faith | logging on 29 February | Gold |
| 127 | Midnight Snack | logging between 00:00 and 04:00 | Bronze |
| 128 | Anniversary | one year since you joined | Gold |
| 129 | Collector | 50 achievements earned | Gold |
| 130 | Completionist | 100 achievements earned | Platinum |

## Rough build plan (for the planner, after sign-off)

1. Core: catalogue as data, a stats snapshot type, pure evaluators, streak maths with freezes,
   points and levels. Logic only, so exempt from the design gate.
2. Database: `user_achievements` (unlocked at, seen at), a freeze ledger and an RPC that returns
   the stats snapshot, with pgTAP tests. Day complete already exists (`day_logs.is_complete`).
3. Design: frames for the Achievements screen, unlock toast, Gold and Platinum moment, Dashboard
   streak chip and streak calendar.
4. Mobile: evaluate after each write (log, weigh-in, workout, recipe), backfill on first launch,
   the screens from step 3.
5. Mobile: unlock notifications (grouping, tap opens the badge, toast instead when open, the
   "Badges and levels" switch and Android channel) and the streak-at-risk reminder switch, both on
   the Reminders screen.
6. Web: read-only Achievements page.
7. A few achievements need tracking that does not exist yet (barcode scans, demo views, week view
   opens). Those ship in a follow-up ticket with their counters.

Tickets: Linear brief KEY-1079, children KEY-1080 to KEY-1096. Zee's rulings on the items that
needed a concept Ki-Lo did not have (KEY-1081) are already folded in above.
