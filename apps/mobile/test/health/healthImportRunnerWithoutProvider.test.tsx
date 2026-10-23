import { render } from "@testing-library/react-native";

import { HealthImportRunner } from "../../components/HealthImportRunner";
import { getHealthProvider } from "../../lib/health";

// The API client is an empty module, so any hook the runner called would throw. Where there is no Health
// provider (every platform but Android) none may be called.
jest.mock("@keylow/api-client", () => ({}));
jest.mock("../../lib/health/getHealthProvider", () => ({ getHealthProvider: jest.fn() }));

describe("the import runner without a provider", () => {
  it("should render without calling a hook of the API client", async () => {
    jest.mocked(getHealthProvider).mockReturnValue(null);

    await expect(render(<HealthImportRunner />)).resolves.toBeDefined();
  });
});
