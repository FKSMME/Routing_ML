import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTensorboardStore } from "../../src/store/tensorboardStore";

const apiMocks = vi.hoisted(() => ({
  fetchTensorboardProjectorsMock: vi.fn(),
  fetchTensorboardProjectorFiltersMock: vi.fn(),
  fetchTensorboardProjectorPointsMock: vi.fn(),
  fetchTensorboardMetricsMock: vi.fn(),
  fetchTensorboardTsneMock: vi.fn(),
}));

vi.mock("@lib/apiClient", () => ({
  fetchTensorboardProjectors: apiMocks.fetchTensorboardProjectorsMock,
  fetchTensorboardProjectorFilters: apiMocks.fetchTensorboardProjectorFiltersMock,
  fetchTensorboardProjectorPoints: apiMocks.fetchTensorboardProjectorPointsMock,
  fetchTensorboardMetrics: apiMocks.fetchTensorboardMetricsMock,
  fetchTensorboardTsne: apiMocks.fetchTensorboardTsneMock,
}));

const initialState = useTensorboardStore.getState();

describe("tensorboardStore status management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTensorboardStore.setState(initialState, true);
  });

  it("marks status as ready after successful projector load", async () => {
    apiMocks.fetchTensorboardProjectorsMock.mockResolvedValue([
      {
        id: "archive/version_20251021083443",
        versionLabel: "version_20251021083443",
        tensorName: "embedding",
        sampleCount: 10,
        updatedAt: "2025-10-23T00:00:00Z",
      },
    ]);
    apiMocks.fetchTensorboardProjectorFiltersMock.mockResolvedValue({ fields: [] });
    apiMocks.fetchTensorboardProjectorPointsMock.mockResolvedValue({
      projectorId: "archive/version_20251021083443",
      total: 10,
      limit: 10000,
      offset: 0,
      points: [],
    });
    apiMocks.fetchTensorboardMetricsMock.mockResolvedValue([]);
    apiMocks.fetchTensorboardTsneMock.mockResolvedValue({
      projectorId: "archive/version_20251021083443",
      total: 0,
      sampled: 0,
      requestedPerplexity: 30,
      effectivePerplexity: 30,
      iterations: 750,
      usedPcaFallback: false,
      points: [],
    });

    await act(async () => {
      await useTensorboardStore.getState().reloadProjectors();
    });

    const state = useTensorboardStore.getState();
    expect(state.status).toBe("ready");
    expect(state.selectedId).toBe("archive/version_20251021083443");
    expect(state.statusMessage).toBeNull();
  });

  it("surfaces errors and sets status to error when projector load fails", async () => {
    apiMocks.fetchTensorboardProjectorsMock.mockRejectedValue(new Error("server offline"));

    let caught: unknown;
    await act(async () => {
      try {
        await useTensorboardStore.getState().reloadProjectors();
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("server offline");

    const state = useTensorboardStore.getState();
    expect(state.status).toBe("error");
    expect(state.statusMessage).toBe("server offline");
    expect(state.projectors).toHaveLength(0);
  });
});
