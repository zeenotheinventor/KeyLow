import { mockApiClient } from "../../foods/support/apiClientMock";

import type { LogEntriesItem } from "@keylow/api-client";

// What the plate is logged with. A test reads what it was called with, and makes it resolve or fail.
export const mockLogEntries = jest.fn<Promise<unknown[]>, [readonly LogEntriesItem[]]>();

// The api client the foods tests use, with the one write the plate makes.
export const mockPlateApiClient = {
  ...mockApiClient,
  useLogEntries: () => ({ mutateAsync: mockLogEntries }),
};

export function resetPlateApiClientMock(): void {
  mockLogEntries.mockReset();
  mockLogEntries.mockResolvedValue([]);
}
