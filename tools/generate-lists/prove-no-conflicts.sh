#!/usr/bin/env bash
# Proves that two branches cut from the same commit, each adding a mobile kit component, a web kit
# component, an icon, a copy module, an icon tone and an animation, rebase onto each other with no
# conflict and still pass the checks that read those lists.
#
# Run from the repository root with a clean working tree: `bash tools/generate-lists/prove-no-conflicts.sh`.
# It makes two throwaway branches, proof-a and proof-b, and deletes them and returns to your branch at the end.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"
original="$(git rev-parse --abbrev-ref HEAD)"
base="$(git rev-parse HEAD)"

if [ -n "$(git status --porcelain)" ]; then
  echo "The working tree must be clean." >&2
  exit 1
fi

cleanup() {
  git checkout --quiet --force "$original"
  git branch --quiet -D proof-a proof-b 2>/dev/null || true
}
trap cleanup EXIT

# add_feature <letter> <lucide icon> adds everything one feature branch adds.
add_feature() {
  local letter="$1" icon="$2" upper file="proof$1"
  upper="$(printf %s "$1" | tr a-z A-Z)"
  local name="Proof$upper"

  local mobile="apps/mobile/components/ui/$name"
  mkdir -p "$mobile"
  printf 'export { %s } from "./%s";\n' "$name" "$name" > "$mobile/index.ts"
  printf 'import { View } from "react-native";\n\nexport function %s() {\n  return <View />;\n}\n' "$name" > "$mobile/$name.tsx"
  printf 'import { %s } from "./%s";\n\nimport type { Meta, StoryObj } from "@storybook/react-native";\n\nconst meta = { title: "UI/%s", component: %s } satisfies Meta<typeof %s>;\n\nexport default meta;\n\nexport const Default: StoryObj<typeof meta> = {};\n' "$name" "$name" "$name" "$name" "$name" > "$mobile/$name.stories.tsx"
  printf 'export const storyStates = ["Default"];\n' > "$mobile/storyStates.ts"

  local web="apps/web/components/ui/$name"
  mkdir -p "$web"
  printf 'export { %s } from "./%s";\n' "$name" "$name" > "$web/index.ts"
  printf 'export function %s() {\n  return <div />;\n}\n' "$name" > "$web/$name.tsx"
  printf 'import { %s } from "./%s";\n\nimport type { Meta, StoryObj } from "@storybook/nextjs";\n\nconst meta = { title: "UI/%s", component: %s } satisfies Meta<typeof %s>;\n\nexport default meta;\n\nexport const Default: StoryObj<typeof meta> = {};\n' "$name" "$name" "$name" "$name" "$name" > "$web/$name.stories.tsx"
  printf 'export const storyStates = ["Default"];\n' > "$web/storyStates.ts"

  # An icon and a tone are each a new file, and the icon map and tone record are generated from the folders.
  printf 'export { %s } from "lucide-react-native";\n' "$icon" > "apps/mobile/components/ui/Icon/icons/$icon.ts"
  printf 'import type { ColorName } from "@keylow/tokens";\n\n/** A tone for the proof. */\nexport const colorName = "warning" satisfies ColorName;\n' > "apps/mobile/components/ui/Icon/tones/proof-$letter.ts"

  printf 'export const describeProof%s = (): string => "Proof %s";\n' "$upper" "$letter" > "packages/core/src/copy/$file.ts"
  printf 'export * from "./%s";\n' "$file" >> packages/core/src/copy/index.ts
  printf 'import * as copy from "../../../src/copy";\n\nexport const samples: Record<string, () => string[]> = {\n  describeProof%s: () => [copy.describeProof%s()],\n};\n' "$upper" "$upper" > "packages/core/test/copy/samples/$file.ts"

  printf '{\n  "keyframes": { "proof-%s": { "to": { "opacity": "1" } } },\n  "animation": { "proof-%s": "proof-%s 1s ease both" }\n}\n' "$letter" "$letter" "$letter" > "apps/web/tailwind/animations/proof-$letter.json"

  git add -A
  git commit --quiet -m "Proof $letter: a component, an icon, a tone, a copy module and an animation"
}

git checkout --quiet -b proof-a "$base"
add_feature a Heart
git checkout --quiet -b proof-b "$base"
add_feature b Star

echo "== proof-a and proof-b both start at $(git rev-parse --short "$base")"
echo "== git rebase proof-a, run on proof-b"
git rebase proof-a
echo "== no conflict. The one file the two features share is the copy index, merged by union locally"
echo "== (GitHub ignores merge=union, so it would still show two such pull requests as conflicting):"
grep -n "proof" packages/core/src/copy/index.ts

echo "== the checks that read those lists, on the merged result"
pnpm generate:lists
grep -n "Heart\|Star" apps/mobile/components/ui/Icon/iconMap.ts
grep -n "proof" apps/mobile/components/ui/Icon/iconColorTones.ts
grep -c "Proof" apps/mobile/components/ui/index.ts | sed 's/^/barrel lines naming a Proof component: /'
(cd apps/mobile && pnpm exec tsc --noEmit && pnpm exec jest test/ui/storyStates.test.ts test/ui/iconMap.test.ts test/ui/Icon.test.tsx 2>&1 | grep -E "^Tests:|^Test Suites:")
(cd packages/core && pnpm exec tsc --noEmit && pnpm exec vitest run test/copy 2>&1 | grep -E "Test Files|Tests")
(cd apps/web && pnpm exec tsc --noEmit && pnpm exec vitest run test/ui/story-manifest.test.ts test/tailwind 2>&1 | grep -E "Test Files|Tests")
echo "== OK: zero conflicts and every check green"
