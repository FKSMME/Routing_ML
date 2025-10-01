import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VisualizationSummary } from "@components/VisualizationSummary";

const baseMetrics = {
  requested_items: 1,
  returned_routings: 1,
  returned_candidates: 1,
  generated_at: "2024-01-01T00:00:00Z",
};

describe("VisualizationSummary", () => {
  it("renders success feedback when files are exported", () => {
    render(
      <VisualizationSummary
        metrics={{
          ...baseMetrics,
          exported_files: ["/tmp/routing_operations.csv"],
        }}
      />,
    );

    expect(screen.getByText(/파일을 성공적으로 저장했습니다/)).toBeInTheDocument();
    expect(screen.getByText(/routing_operations\.csv/)).toBeInTheDocument();
    expect(screen.queryByText(/내보내기 실패/)).not.toBeInTheDocument();
  });

  it("renders failure details when export errors are provided", () => {
    render(
      <VisualizationSummary
        metrics={{
          ...baseMetrics,
          exported_files: ["/tmp/routing_operations.csv"],
          export_errors: [
            {
              path: "/tmp/routing_bundle.json",
              error: "IOError: disk full",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(/내보내기 실패가 발생했습니다/)).toBeInTheDocument();
    expect(screen.getByText(/routing_bundle\.json/)).toBeInTheDocument();
    expect(screen.getByText(/IOError: disk full/)).toBeInTheDocument();
  });
});
