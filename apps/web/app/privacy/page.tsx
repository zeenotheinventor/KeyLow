import { PRIVACY_POLICY } from "@keylow/core/copy";

import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: `${PRIVACY_POLICY.title} | Ki-Lo`,
};

export default function PrivacyPage() {
  return <LegalPage legalDocument={PRIVACY_POLICY} />;
}
