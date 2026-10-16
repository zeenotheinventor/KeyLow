export type ReportedErrorProps = {
  error: Error & { digest?: string };
  /** The Next.js error boundary's retry, which renders the failed part again. */
  reset: () => void;
};
