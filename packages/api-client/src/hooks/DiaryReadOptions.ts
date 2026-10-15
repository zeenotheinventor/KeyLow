/** What every diary read hook takes. */
export type DiaryReadOptions = {
  /**
   * False makes no request at all. The mobile app passes false while the terms gate is up, since
   * it stays mounted under the cover. Defaults to true.
   */
  enabled?: boolean;
};
