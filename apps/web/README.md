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

Use Tailwind utilities bound to the token preset (`bg-brand-500`, `text-neutral-50`). The HSL variables in `app/globals.css` are the shadcn theme and the only place raw colour values live. shadcn is pinned to the Tailwind 3 CLI (`npx shadcn@2.3.0 add <component>`), because the current `shadcn@latest` generates Tailwind 4 only output.

## Vercel

Set these on the Vercel project:

- Root Directory: `apps/web`
- Include source files outside of the Root Directory in the Build Step: enabled
- Framework Preset: Next.js
- Install Command and Build Command: the defaults (Vercel detects pnpm from the workspace lockfile)
- Node.js Version: 22.x
- Ignored Build Step: set by `vercel.json` (`npx turbo-ignore`), so leave the dashboard field unset
