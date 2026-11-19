import type { WebCatalogueCategory } from "@keylow/core/copy";

export type CategorySectionProps = {
  category: WebCatalogueCategory;
  onOpenBadge: (id: WebCatalogueCategory["badges"][number]["id"]) => void;
};
