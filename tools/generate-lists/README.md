# @keylow/generate-lists

Writes the lists that would otherwise be edited by every feature branch, and so conflict. Every output is ignored by git, so none can conflict.

```sh
pnpm generate:lists                  # all of them
pnpm generate:lists ui-barrel        # apps/mobile/components/ui/index.ts only
pnpm generate:lists story-index      # apps/mobile/.rnstorybook/storybook.requires.ts only
```

- `ui-barrel` writes `export * from "./Folder";` for every folder of `apps/mobile/components/ui`, except one whose `index.ts` starts with `// @not-in-barrel`.
- `icon-map` writes `Icon/iconMap.ts` from the files in `Icon/icons`, one per icon.
- `icon-tones` writes `Icon/iconColorTones.ts` from the files in `Icon/tones`, one per colour tone.
- `story-index` runs Storybook's own `sb-rn-get-stories`, the command Metro runs when Storybook is on, so tsc, ESLint and Jest have the file without Metro.

Turbo runs it (`//#generate:lists` in `turbo.json`, a prerequisite in `apps/mobile/turbo.json`) before the mobile app's `lint`, `typecheck` and `test`, and `apps/mobile/metro.config.js` and `jest.config.js` run it on start. It is not a package script of the mobile app on purpose: a script name is part of the native fingerprint.
