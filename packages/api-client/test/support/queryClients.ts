import { QueryClient } from "@tanstack/react-query";

import type { QueryClientConfig } from "@tanstack/react-query";

const queryClientsOfTheRunningTest: QueryClient[] = [];

/** A query client that `clearQueryClients` empties after the test, so its timers and queries do not outlive it. */
export function createQueryClient(config?: QueryClientConfig) {
  const queryClient = new QueryClient(config);
  queryClientsOfTheRunningTest.push(queryClient);
  return queryClient;
}

export function clearQueryClients() {
  for (const queryClient of queryClientsOfTheRunningTest.splice(0)) {
    queryClient.clear();
  }
}
