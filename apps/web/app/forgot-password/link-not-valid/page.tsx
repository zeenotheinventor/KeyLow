import { RESET_LINK_INVALID, describeResetLinkInvalid } from "@keylow/core/copy";
import { TriangleAlert } from "lucide-react";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthMessageCard } from "@/components/auth/AuthMessageCard";

export default function LinkNotValidPage() {
  return (
    <AuthCard>
      <AuthMessageCard
        tone="danger"
        icon={TriangleAlert}
        title={RESET_LINK_INVALID.title}
        body={describeResetLinkInvalid("browser")}
        primaryAction={{ label: RESET_LINK_INVALID.sendNewLinkLabel, href: "/forgot-password" }}
        secondaryAction={{ label: RESET_LINK_INVALID.backToSignInLabel, href: "/login" }}
      />
    </AuthCard>
  );
}
