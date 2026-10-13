repo: zeenotheinventor/KeyLow
branch: main

## Last sync
date: 2026-10-07T15:33:00Z

### Updated in this project
- Read the placeholder token preset, web globals.css, mobile tab layout and food components to ground copy voice and number formatting.
- Built the full token set (dark + light), 22 components and specimen cards from the brief; the repo's Tailwind-default tokens are replaced by `tokens/tailwind.preset.js`.

## Screen map
| Project | Repo files |
| --- | --- |
| tokens/colors.css, tokens/typography.css, tokens/spacing.css, tokens/tailwind.preset.js | packages/tokens/src/index.ts, apps/web/app/globals.css |
| components/navigation/TabBar.jsx | apps/mobile/app/(tabs)/_layout.tsx |
| components/surfaces/ListRow.jsx, components/feedback/Badge.jsx | apps/mobile/components/FoodSearch/FoodRow/FoodRow.tsx, apps/mobile/lib/foodSourceLabel.ts |
| components/forms/Input.jsx | apps/mobile/components/FoodForm/FormField/FormField.tsx |
| components/feedback/Banner.jsx | apps/mobile/components/FoodDetail/FoodDetail.tsx, apps/web/components/foods/FoodDetail/MissingValuesReview/MissingValuesReview.tsx |
| components/feedback/EmptyState.jsx | apps/mobile/components/FoodLoadState/FoodLoadState.tsx, apps/mobile/components/FoodSearch/FoodSearch.tsx |
| components/core/kl.js (Format) | apps/mobile/lib/formatAmount.ts, apps/web/components/foods/foodDisplay.ts |
