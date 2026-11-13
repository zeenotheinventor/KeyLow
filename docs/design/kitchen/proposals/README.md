# Ki-Lo kitchen (M9 proposals)

Mobile proposal boards for M9 (KEY-216): palate, foods to avoid, recipe suggestion and adjustment, and meal plans. They were drawn for KEY-1021 and are not yet on a canvas, so they sit in this `proposals/` folder, where `tools/design-export` does not look. Each board is an `.html` page that opens from `file://` with the token stylesheet in `packages/tokens`, and a `.png` rendered at device pixel ratio 2, dark on the left and light on the right.

The decisions, kit pieces, new strings and the sources of every number are in two notes files, one per lane:

- [proposals/kitchen-recipes.md](kitchen-recipes.md): palate, foods to avoid, recipe drafts, adjustment, the long working line.
- [proposals/kitchen-plan.md](kitchen-plan.md): the meal plan screens and cards.

## Lane A: palate, foods to avoid, recipes

| Board                                              | Files                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `kitchen · palate`                                 | [html](kitchen-palate.html), [png](kitchen-palate.png)                                               |
| `kitchen · palate-empty`                           | [html](kitchen-palate-empty.html), [png](kitchen-palate-empty.png)                                   |
| `kitchen · palate-corrected`                       | [html](kitchen-palate-corrected.html), [png](kitchen-palate-corrected.png)                           |
| `settings · foods-to-avoid`                        | [html](settings-foods-to-avoid.html), [png](settings-foods-to-avoid.png)                             |
| `settings · assistant-your-food` (the entry point) | [html](settings-assistant-your-food.html), [png](settings-assistant-your-food.png)                   |
| `assistant-card · recipe-draft`                    | [html](assistant-card-recipe-draft.html), [png](assistant-card-recipe-draft.png)                     |
| `assistant-card · recipe-draft-short`              | [html](assistant-card-recipe-draft-short.html), [png](assistant-card-recipe-draft-short.png)         |
| `assistant-card · recipe-draft-unmatched`          | [html](assistant-card-recipe-draft-unmatched.html), [png](assistant-card-recipe-draft-unmatched.png) |
| `assistant-card · recipe-draft-failed`             | [html](assistant-card-recipe-draft-failed.html), [png](assistant-card-recipe-draft-failed.png)       |
| `assistant-card · recipe-draft-saved`              | [html](assistant-card-recipe-draft-saved.html), [png](assistant-card-recipe-draft-saved.png)         |
| `assistant · working-long`                         | [html](assistant-working-long.html), [png](assistant-working-long.png)                               |
| `assistant-card · recipe-compare`                  | [html](assistant-card-recipe-compare.html), [png](assistant-card-recipe-compare.png)                 |
| `assistant-card · recipe-compare`, refused         | [html](assistant-card-recipe-compare-refused.html), [png](assistant-card-recipe-compare-refused.png) |

`kitchen · compare` is not drawn: the compare card is big enough (see the lane A notes).

Error, loading and empty states that no board draws follow the kit's existing patterns: `AssistantNotice` and the failed turn for errors in the thread, `ErrorState` and `Banner` on a screen, `Skeleton` and the `WorkingLine` while loading, and `EmptyState` when there is nothing to show. The open "Show all 10" list and open Instructions expand in place, as `RoutineDayRow` does.

## Lane B: meal plans

| Board                                 | Files                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `diary · plan-entry`                  | [html](diary-plan-entry.html), [png](diary-plan-entry.png)                                   |
| `plan · week`                         | [html](plan-week.html), [png](plan-week.png)                                                 |
| `plan · day`                          | [html](plan-day.html), [png](plan-day.png)                                                   |
| `plan · day-confirmed`                | [html](plan-day-confirmed.html), [png](plan-day-confirmed.png)                               |
| `plan · day-short`                    | [html](plan-day-short.html), [png](plan-day-short.png)                                       |
| `plan · empty`                        | [html](plan-empty.html), [png](plan-empty.png)                                               |
| `plan · settings`                     | [html](plan-settings.html), [png](plan-settings.png)                                         |
| `plan · first-plan-variety`           | [html](plan-first-plan-variety.html), [png](plan-first-plan-variety.png)                     |
| `plan · shopping-added`               | [html](plan-shopping-added.html), [png](plan-shopping-added.png)                             |
| `assistant-card · plan-created`       | [html](assistant-card-plan-created.html), [png](assistant-card-plan-created.png)             |
| `assistant-card · plan-day-replanned` | [html](assistant-card-plan-day-replanned.html), [png](assistant-card-plan-day-replanned.png) |
