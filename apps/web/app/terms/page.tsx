import { TERMS } from "@keylow/core/copy";

import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: `${TERMS.title} | Ki-Lo`,
};

export default function TermsPage() {
  return <LegalPage legalDocument={TERMS} />;
}
