import type { LegalDocument } from "@keylow/core/copy";

export type LegalPageProps = {
  /** The document to show: its title, the date it was last updated and its sections. */
  legalDocument: LegalDocument;
};
