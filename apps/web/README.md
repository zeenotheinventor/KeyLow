# @keylow/web

The KeyLow web app: Next.js (App Router), Tailwind CSS 3 with the shared `@keylow/tokens` preset, and shadcn/ui primitives. Workspace packages are consumed as TypeScript source and listed in `transpilePackages` in `next.config.ts`.

## Scripts

```sh
pnpm --filter @keylow/web dev        # http://localhost:3000
pnpm --filter @keylow/web build
pnpm --filter @keylow/web lint
pnpm --filter @keylow/web typecheck
pnpm --filter @keylow/web test
```

## Styling

Use Tailwind utilities bound to the Ki-Lo tokens (`bg-surface`, `text-text-primary`, `border-border`). Never write a raw colour.

`tailwind.config.ts` loads the `@keylow/tokens` preset and its `themePlugin`, which emits the `--kl-*` colour variables on `:root` (dark, the default) and under `[data-theme="light"]`. So one class follows the theme. The plugin is used rather than the generated `kilo-tokens.css`, because the preset's colour classes read the `--kl-*` variables and the plain CSS file defines different names.

The server sets `data-theme` on `<html>` from the `kl-theme` cookie (`light`, `device` or anything else for dark), so there is no flash. `lib/theme/setTheme.ts` switches the open page and has the `writeThemeCookie` server action remember the choice. The Appearance control on More (Dark, Light, Match device) calls it. `device` leaves the dark colours on `:root` and a `prefers-color-scheme: light` rule in `lib/theme/matchDeviceTheme.ts` swaps in the light ones, so Match device needs no script and does not flash.

Geist is loaded by `next/font/google` in `app/layout.tsx`, self-hosted at build time. It reaches the `font-sans` class through `--font-geist`, ahead of the design's own font stack. Icons are Lucide (`lucide-react`).

shadcn is pinned to the Tailwind 3 CLI (`npx shadcn@2.3.0 add <component>`), because the current `shadcn@latest` generates Tailwind 4 only output. A generated component uses shadcn's colour names (`bg-primary`, `text-muted-foreground`), which no longer exist here, so retarget them to the Ki-Lo names.

## Vercel

Set these on the Vercel project:

- Root Directory: `apps/web`
- Include source files outside of the Root Directory in the Build Step: enabled
- Framework Preset: Next.js
- Install Command and Build Command: the defaults (Vercel detects pnpm from the workspace lockfile)
- Node.js Version: 22.x
- Ignored Build Step: set by `vercel.json` (`npx turbo-ignore`), so leave the dashboard field unset
- Deployments: only `main` deploys. `vercel.json` turns off every other branch, so pull requests get no preview (see [docs/ci.md](../../docs/ci.md))
