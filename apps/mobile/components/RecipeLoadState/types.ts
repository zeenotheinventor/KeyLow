export type RecipeLoadStateProps = {
  state: "loading" | "error" | "notFound";
  onBack: () => void;
  onRetry: () => void;
};
