export type DataSourceCreditProps = {
  /** The name of the source. */
  name: string;
  /** The statement the source's licence asks for. */
  text: string;
  /** The address the credit links to. Left out where no single publisher is the source, and the credit then has no link. */
  url?: string;
};
