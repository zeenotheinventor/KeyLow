import { describeRoleRow } from "@keylow/core/copy";
import { View } from "react-native";

import { Text } from "../../ui";

import type { RoleRowProps } from "./types";
import type { MuscleRole } from "@keylow/core/training";

// The role scale's colours, from the tokens. The classes are written out so Tailwind sees them.
const swatchClassNames: Record<MuscleRole, string> = {
  primary: "bg-role-primary",
  secondary: "bg-role-secondary",
  stabiliser: "bg-role-assist",
};

/**
 * One role of the Muscles it works sheet: its colour as a swatch, the muscles that have it, and under them
 * the role and what a set counts for. The row is one element named in words ("Glutes, Hamstrings,
 * Secondary · counts half"), so the swatch's colour is never the only way to read the role.
 */
export function RoleRow({ role, muscles, hasDivider }: RoleRowProps) {
  const row = describeRoleRow(role, muscles);

  return (
    <View
      accessible
      aria-label={`${row.muscles}, ${row.role}`}
      className={`min-h-[48px] flex-row items-center gap-3 px-3 py-2${hasDivider ? " border-t border-border" : ""}`}
      role="listitem"
    >
      <View
        aria-hidden
        className={`h-[14px] w-[14px] shrink-0 rounded-[4px] border border-border ${swatchClassNames[role]}`}
      />
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text variant="body-strong">{row.muscles}</Text>
        <Text tone="secondary" variant="caption">
          {row.role}
        </Text>
      </View>
    </View>
  );
}
