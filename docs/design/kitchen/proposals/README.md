# Ki-Lo kitchen (M9 proposals)

Mobile proposal boards for M9 (KEY-216): palate, foods to avoid, recipe suggestion and adjustment, and meal plans. They were drawn for KEY-1021 and are not yet on a canvas, so they sit in `proposals/`, where `tools/design-export` does not look. Each board is an `.html` page that opens from `file://` with the token stylesheet in `packages/tokens`, and a `.png` rendered at device pixel ratio 2, dark on the left and light on the right.

The decisions, kit pieces, new strings and the sources of every number are in two notes files, one per lane:

- [proposals/kitchen-recipes.md](proposals/kitchen-recipes.md): palate, foods to avoid, recipe drafts, adjustment, the long working line.
- [proposals/kitchen-plan.md](proposals/kitchen-plan.md): the meal plan screens and cards.

## Lane A: palate, foods to avoid, recipes

| Board                                              | Files                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `kitchen · palate`                                 | [html](proposals/kitchen-palate.html), [png](proposals/kitchen-palate.png)                                               |
| `kitchen · palate-empty`                           | [html](proposals/kitchen-palate-empty.html), [png](proposals/kitchen-palate-empty.png)                                   |
| `kitchen · palate-corrected`                       | [html](proposals/kitchen-palate-corrected.html), [png](proposals/kitchen-palate-corrected.png)                           |
| `settings · foods-to-avoid`                        | [html](proposals/settings-foods-to-avoid.html), [png](proposals/settings-foods-to-avoid.png)                             |
| `settings · assistant-your-food` (the entry point) | [html](proposals/settings-assistant-your-food.html), [png](proposals/settings-assistant-your-food.png)                   |
| `assistant-card · recipe-draft`                    | [html](proposals/assistant-card-recipe-draft.html), [png](proposals/assistant-card-recipe-draft.png)                     |
| `assistant-card · recipe-draft-short`              | [html](proposals/assistant-card-recipe-draft-short.html), [png](proposals/assistant-card-recipe-draft-short.png)         |
| `assistant-card · recipe-draft-unmatched`          | [html](proposals/assistant-card-recipe-draft-unmatched.html), [png](proposals/assistant-card-recipe-draft-unmatched.png) |
| `assistant-card · recipe-draft-failed`             | [html](proposals/assistant-card-recipe-draft-failed.html), [png](proposals/assistant-card-recipe-draft-failed.png)       |
| `assistant-card · recipe-draft-saved`              | [html](proposals/assistant-card-recipe-draft-saved.html), [png](proposals/assistant-card-recipe-draft-saved.png)         |
| `assistant · working-long`                         | [html](proposals/assistant-working-long.html), [png](proposals/assistant-working-long.png)                               |
| `assistant-card · recipe-compare`                  | [html](proposals/assistant-card-recipe-compare.html), [png](proposals/assistant-card-recipe-compare.png)                 |
| `assistant-card · recipe-compare`, refused         | [html](proposals/assistant-card-recipe-compare-refused.html), [png](proposals/assistant-card-recipe-compare-refused.png) |

`kitchen · compare` is not drawn: the compare card is big enough (see the lane A notes).

Error, loading and empty states that no board draws follow the kit's existing patterns: `AssistantNotice` and the failed turn for errors in the thread, `ErrorState` and `Banner` on a screen, `Skeleton` and the `WorkingLine` while loading, and `EmptyState` when there is nothing to show. The open "Show all 10" list and open Instructions expand in place, as `RoutineDayRow` does.

## Lane B: meal plans

| Board                                 | Files                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `diary · plan-entry`                  | [html](proposals/diary-plan-entry.html), [png](proposals/diary-plan-entry.png)                                   |
| `plan · week`                         | [html](proposals/plan-week.html), [png](proposals/plan-week.png)                                                 |
| `plan · day`                          | [html](proposals/plan-day.html), [png](proposals/plan-day.png)                                                   |
| `plan · day-confirmed`                | [html](proposals/plan-day-confirmed.html), [png](proposals/plan-day-confirmed.png)                               |
| `plan · day-short`                    | [html](proposals/plan-day-short.html), [png](proposals/plan-day-short.png)                                       |
| `plan · empty`                        | [html](proposals/plan-empty.html), [png](proposals/plan-empty.png)                                               |
| `plan · settings`                     | [html](proposals/plan-settings.html), [png](proposals/plan-settings.png)                                         |
| `plan · first-plan-variety`           | [html](proposals/plan-first-plan-variety.html), [png](proposals/plan-first-plan-variety.png)                     |
| `plan · shopping-added`               | [html](proposals/plan-shopping-added.html), [png](proposals/plan-shopping-added.png)                             |
| `assistant-card · plan-created`       | [html](proposals/assistant-card-plan-created.html), [png](proposals/assistant-card-plan-created.png)             |
| `assistant-card · plan-day-replanned` | [html](proposals/assistant-card-plan-day-replanned.html), [png](proposals/assistant-card-plan-day-replanned.png) |
