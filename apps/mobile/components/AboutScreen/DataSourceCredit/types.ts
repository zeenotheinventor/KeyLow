export type DataSourceCreditProps = {
  /** The name of the source, which the credit is headed with. */
  name: string;
  /** The statement the source's licence asks to be shown. */
  text: string;
  /** Where the source is published, shown as a link that opens in the browser. Left out where no single publisher is the source, and the credit then has no link. */
  url?: string;
};
